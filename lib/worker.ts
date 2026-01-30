import { watch } from 'chokidar';
import { createHash } from 'crypto';
import { readFileSync, copyFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { prisma } from './prisma';
import { processWithDocumentAI, createSearchablePDF } from './google';
import { getPaperlessClient } from './paperless';
import { createLogger } from './logger';
import { getConfig, CONFIG_KEYS } from './config';
import { getPDFInfo, detectAndRotatePDF, removeOCRLayer, exceedsLimits } from './pdf-processor';
import { canProcessWithDocumentAI, reserveDocumentAIPages } from './cost-tracking';
import { startAiTodoPolling, stopAiTodoPolling } from './polling';
import { startActionPolling, stopActionPolling } from './action-polling';
import { acquireLock, releaseLock, updateLockActivity } from './process-lock';
import { checkEmergencyStop } from './emergency-stop';

const logger = createLogger('Worker');

// Determine directories based on environment
function getDirectories() {
  // Check if we're in development mode (not in Docker)
  if (!existsSync('/app/storage') && existsSync('./test-consume')) {
    return {
      consume: './test-consume',
      processing: './test-consume/processing',
      error: './test-consume/error',
    };
  }

  return {
    consume: process.env.CONSUME_DIR || '/app/storage/consume',
    processing: process.env.PROCESSING_DIR || '/app/storage/processing',
    error: process.env.ERROR_DIR || '/app/storage/error',
  };
}

const dirs = getDirectories();
const CONSUME_DIR = dirs.consume;
const PROCESSING_DIR = dirs.processing;
const ERROR_DIR = dirs.error;

// Ensure directories exist (called at runtime)
function ensureDirectories() {
  [CONSUME_DIR, PROCESSING_DIR, ERROR_DIR].forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });
}

function calculateFileHash(filePath: string): string {
  const buffer = readFileSync(filePath);
  return createHash('sha256').update(buffer).digest('hex');
}

async function processFile(filePath: string) {
  const fileName = filePath.split('/').pop() || 'unknown';
  await logger.info(`📄 Processing file: ${fileName}`);

  // Check emergency stop
  try {
    await checkEmergencyStop('File processing');
  } catch (error) {
    await logger.warn(`🚨 File processing blocked by emergency stop: ${fileName}`);
    return;
  }

  let processingPath: string | null = null;
  let rotatedPath: string | null = null;
  let noOCRPath: string | null = null;
  let searchablePath: string | null = null;
  let documentId: number | null = null;

  try {
    // Calculate hash
    const fileHash = calculateFileHash(filePath);

    // Check for duplicates
    const existing = await prisma.document.findUnique({
      where: { fileHash },
    });

    if (existing) {
      await logger.warn(`🛑 Duplicate file detected: ${fileName}`);
      const errorPath = join(ERROR_DIR, fileName);
      copyFileSync(filePath, errorPath);
      unlinkSync(filePath);
      return;
    }

    // Move to processing
    processingPath = join(PROCESSING_DIR, fileName);
    copyFileSync(filePath, processingPath);
    unlinkSync(filePath);
    await logger.info(`✅ Moved to processing: ${fileName}`);

    // Create document record
    const document = await prisma.document.create({
      data: {
        originalFilename: fileName,
        fileHash,
        filePath: processingPath,
        status: 'PENDING',
      },
    });
    documentId = document.id;

    // Get PDF info
    const pdfInfo = await getPDFInfo(processingPath);
    await logger.info(`📊 PDF Info: ${pdfInfo.pages} pages, ${pdfInfo.sizeMB.toFixed(2)} MB`);

    // Get configuration
    const docAIEnabled = (await getConfig(CONFIG_KEYS.DOCUMENT_AI_ENABLED)) === 'true';
    const maxPages = parseInt(await getConfig(CONFIG_KEYS.DOCUMENT_AI_MAX_PAGES) || '15');
    const maxSizeMB = parseInt(await getConfig(CONFIG_KEYS.DOCUMENT_AI_MAX_SIZE_MB) || '20');
    const aiTodoTag = await getConfig(CONFIG_KEYS.TAG_AI_TODO) || 'ai_todo';

    let finalPath = processingPath;

    // Check if we should use Document AI
    if (!docAIEnabled) {
      await logger.info(`⏩ Document AI disabled, uploading directly to Paperless`);
    } else if (exceedsLimits(pdfInfo, maxPages, maxSizeMB)) {
      await logger.info(`⏩ Document exceeds limits (max: ${maxPages} pages, ${maxSizeMB} MB), skipping Document AI`);
      await logger.info(`   Paperless will handle OCR with Tesseract`);
    } else {
      // CRITICAL: Check monthly limit BEFORE processing
      const limitCheck = await canProcessWithDocumentAI(pdfInfo.pages);
      if (!limitCheck.allowed) {
        await logger.warn(`⚠️ Monthly Document AI limit reached, skipping: ${limitCheck.reason}`);
        await logger.info(`   Paperless will handle OCR with Tesseract`);
        // Continue without Document AI
      } else {
        // CRITICAL: Reserve pages BEFORE API call to ensure limit is not exceeded
        await logger.info(`🔄 Processing with Document AI...`);
        const reserved = await reserveDocumentAIPages(pdfInfo.pages);
        if (!reserved) {
          await logger.error(`Failed to reserve Document AI pages, skipping`);
        } else {
          await logger.info(`✅ Reserved ${pdfInfo.pages} pages from monthly budget`);

          // Update status
          await prisma.document.update({
            where: { id: documentId },
            data: { status: 'PREPROCESSING', ocrPageCount: pdfInfo.pages },
          });

          // Step 1: Detect and rotate if needed
          const [rotated, wasRotated] = await detectAndRotatePDF(processingPath);
          if (wasRotated) {
            rotatedPath = rotated;
            finalPath = rotated;
            await logger.info(`🔄 PDF rotated: ${rotatedPath}`);
          }

          // Step 2: Remove existing OCR layer
          noOCRPath = await removeOCRLayer(finalPath);
          finalPath = noOCRPath;
          await logger.info(`🧹 OCR layer removed: ${noOCRPath}`);

          // Update status
          await prisma.document.update({
            where: { id: documentId },
            data: { status: 'OCR_IN_PROGRESS' },
          });

          // Step 3: Process with Document AI
          const docAIResult = await processWithDocumentAI(finalPath);

          // Step 4: Create searchable PDF
          searchablePath = join(PROCESSING_DIR, fileName.replace('.pdf', '_searchable.pdf'));
          await createSearchablePDF(finalPath, docAIResult, searchablePath);
          finalPath = searchablePath;

          await logger.info(`✅ Document AI processing complete`);

          // Update status
          await prisma.document.update({
            where: { id: documentId },
            data: { status: 'OCR_COMPLETE' },
          });
        }
      }
    }

    // Upload to Paperless
    await logger.info(`📤 Uploading to Paperless...`);
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'UPLOADING_TO_PAPERLESS' },
    });

    const paperless = await getPaperlessClient();
    const paperlessId = await paperless.uploadDocument(finalPath, [aiTodoTag]);

    // Update final status
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'COMPLETED',
        paperlessId: paperlessId,
      },
    });

    await logger.info(`✅ Successfully processed: ${fileName} (Paperless ID: ${paperlessId})`);

    // Cleanup temporary files
    if (rotatedPath && existsSync(rotatedPath)) unlinkSync(rotatedPath);
    if (noOCRPath && existsSync(noOCRPath)) unlinkSync(noOCRPath);
    if (searchablePath && existsSync(searchablePath)) unlinkSync(searchablePath);
    if (processingPath && existsSync(processingPath)) unlinkSync(processingPath);

  } catch (error: any) {
    await logger.error(`❌ Error processing ${fileName}`, error);

    // Update document status
    if (documentId) {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'ERROR',
          errorMessage: error.message || 'Unknown error',
        },
      });
    }

    // Move to error directory
    try {
      const errorPath = join(ERROR_DIR, fileName);

      // Try to move the file from processing if it exists
      if (processingPath && existsSync(processingPath)) {
        copyFileSync(processingPath, errorPath);
        unlinkSync(processingPath);
      }

      await logger.warn(`📁 Moved to error directory: ${fileName}`);

      // Cleanup temporary files
      if (rotatedPath && existsSync(rotatedPath)) unlinkSync(rotatedPath);
      if (noOCRPath && existsSync(noOCRPath)) unlinkSync(noOCRPath);
      if (searchablePath && existsSync(searchablePath)) unlinkSync(searchablePath);

    } catch (moveError) {
      await logger.error(`Failed to move file to error directory`, moveError);
    }
  }
}

let watcher: any = null;

export async function startWorker() {
  if (watcher) {
    await logger.info('Worker already running');
    return;
  }

  // Acquire worker lock
  const lockAcquired = await acquireLock('WORKER_CONSUME', 'File watcher active');
  if (!lockAcquired) {
    await logger.warn('Worker lock already held, cannot start worker');
    return;
  }

  // Ensure directories exist
  ensureDirectories();

  await logger.info(`Starting worker, watching: ${CONSUME_DIR}`);

  watcher = watch(CONSUME_DIR, {
    ignored: /^\./,
    persistent: true,
    ignoreInitial: false, // Process existing files on startup
    // No awaitWriteFinish - trust the OS. Files are only visible when write is complete.
  });

  watcher.on('add', (path: string) => {
    if (path.toLowerCase().endsWith('.pdf')) {
      processFile(path);
    }
  });

  watcher.on('error', async (error: Error) => {
    await logger.error('Watcher error', error);
  });

  await logger.info('Worker started successfully');

  // Update worker lock activity periodically (every 30 seconds)
  const lockUpdateInterval = setInterval(async () => {
    await updateLockActivity('WORKER_CONSUME');
  }, 30000);

  // Store interval ID for cleanup
  (watcher as any).lockUpdateInterval = lockUpdateInterval;

  // Start AI_TODO polling (if enabled)
  await startAiTodoPolling();

  // Start Action polling (if enabled)
  await startActionPolling();
}

export async function stopWorker() {
  if (watcher) {
    // Clear lock update interval
    if ((watcher as any).lockUpdateInterval) {
      clearInterval((watcher as any).lockUpdateInterval);
    }

    watcher.close();
    watcher = null;
    await logger.info('Worker stopped');

    // Release worker lock
    await releaseLock('WORKER_CONSUME');
  }

  // Stop AI_TODO polling
  await stopAiTodoPolling();

  // Stop Action polling
  await stopActionPolling();
}
