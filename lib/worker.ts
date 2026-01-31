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
import { sendDocumentProcessedEmail, sendDocumentErrorEmail } from './email';

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

/**
 * Clean up orphaned documents in database
 * Documents with PENDING/PROCESSING status but no file in filesystem
 */
async function cleanupOrphanedDocuments() {
  try {
    const processingDocs = await prisma.document.findMany({
      where: {
        status: {
          in: ['PENDING', 'PENDING_CONFIGURATION', 'PREPROCESSING', 'OCR_IN_PROGRESS', 'OCR_COMPLETE', 'UPLOADING_TO_PAPERLESS']
        },
        filePath: {
          not: null
        }
      }
    });

    if (processingDocs.length === 0) {
      return;
    }

    let cleaned = 0;
    for (const doc of processingDocs) {
      if (!doc.filePath) continue;

      // Check if file exists
      if (!existsSync(doc.filePath)) {
        await logger.warn(`Orphaned document found: ${doc.originalFilename} (ID: ${doc.id}), file not found at: ${doc.filePath}`);

        // Update document status to ERROR
        await prisma.document.update({
          where: { id: doc.id },
          data: {
            status: 'ERROR',
            errorMessage: 'Datei wurde nicht gefunden - möglicherweise manuell gelöscht oder verschoben'
          }
        });

        cleaned++;
      }
    }

    if (cleaned > 0) {
      await logger.info(`✅ Cleaned up ${cleaned} orphaned document(s)`);
    }
  } catch (error: any) {
    await logger.error('Failed to cleanup orphaned documents', error);
  }
}

function calculateFileHash(filePath: string): string {
  const buffer = readFileSync(filePath);
  return createHash('sha256').update(buffer).digest('hex');
}

async function processFile(filePath: string) {
  const fileName = filePath.split('/').pop() || 'unknown';

  await logger.info(``);
  await logger.info(`🚀 ========================================`);
  await logger.info(`🚀 NEW DOCUMENT DETECTED`);
  await logger.info(`🚀 ========================================`);
  await logger.info(`   → File: ${fileName}`);
  await logger.info(`   → Path: ${filePath}`);
  await logger.info(`   → Time: ${new Date().toISOString()}`);
  await logger.info(`🚀 ========================================`);
  await logger.info(``);

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

  // Processing details for debugging
  let rotatedPagesCount = 0;
  let usedDocumentAI = false;
  let ocrLayerRemoved = false;
  let searchablePdfCreated = false;

  try {
    // Calculate hash
    await logger.info(`🔐 Calculating SHA-256 hash for: ${fileName}`);
    const fileHash = calculateFileHash(filePath);
    await logger.info(`🔐 Hash: ${fileHash.substring(0, 32)}...`);

    // Check for duplicates
    await logger.info(`🔍 Checking database for duplicates...`);
    const existing = await prisma.document.findUnique({
      where: { fileHash },
    });

    if (existing) {
      await logger.warn(`🛑 DUPLICATE DETECTED: ${fileName}`);
      await logger.warn(`   → Existing Document ID: ${existing.id}`);
      await logger.warn(`   → Original Filename: ${existing.originalFilename}`);
      if (existing.paperlessId) {
        await logger.warn(`   → Paperless ID: ${existing.paperlessId}`);
      }
      await logger.warn(`   → Moving to error folder: ${fileName}`);
      const errorPath = join(ERROR_DIR, fileName);
      copyFileSync(filePath, errorPath);
      unlinkSync(filePath);
      return;
    }

    await logger.info(`✅ No duplicate found - file is unique`);

    // Move to processing
    await logger.info(`📁 Moving file to processing folder...`);
    processingPath = join(PROCESSING_DIR, fileName);
    copyFileSync(filePath, processingPath);
    unlinkSync(filePath);
    await logger.info(`✅ Moved to processing: ${processingPath}`);
    await logger.info(``);

    // Create document record
    await logger.info(`💾 Creating database record...`);
    const document = await prisma.document.create({
      data: {
        originalFilename: fileName,
        fileHash,
        filePath: processingPath,
        status: 'PENDING',
      },
    });
    documentId = document.id;
    await logger.info(`✅ Document created in database: ID ${documentId}`);
    await logger.info(`   → Status: PENDING`);
    await logger.info(`   → File path: ${processingPath}`);
    await logger.info(``);

    // Get PDF info
    await logger.info(`📊 Analyzing PDF structure...`);
    const pdfInfo = await getPDFInfo(processingPath);
    await logger.info(`✅ PDF Info retrieved:`);
    await logger.info(`   → Pages: ${pdfInfo.pages}`);
    await logger.info(`   → Size: ${pdfInfo.sizeMB.toFixed(2)} MB`);
    await logger.info(`   → Dimensions: ${pdfInfo.width}x${pdfInfo.height} pt`);
    await logger.info(``);

    // Get configuration
    await logger.info(`⚙️  Loading configuration...`);
    const docAIEnabled = (await getConfig(CONFIG_KEYS.DOCUMENT_AI_ENABLED)) === 'true';
    const maxPages = parseInt(await getConfig(CONFIG_KEYS.DOCUMENT_AI_MAX_PAGES) || '15');
    const maxSizeMB = parseInt(await getConfig(CONFIG_KEYS.DOCUMENT_AI_MAX_SIZE_MB) || '20');
    const aiTodoTag = await getConfig(CONFIG_KEYS.TAG_AI_TODO) || 'ai_todo';
    await logger.info(`✅ Configuration loaded:`);
    await logger.info(`   → Document AI enabled: ${docAIEnabled}`);
    await logger.info(`   → Max pages: ${maxPages}`);
    await logger.info(`   → Max size: ${maxSizeMB} MB`);
    await logger.info(`   → AI Todo tag: ${aiTodoTag}`);
    await logger.info(``);

    let finalPath = processingPath;

    // Check if we should use Document AI
    await logger.info(`🤔 Evaluating Document AI processing...`);
    if (!docAIEnabled) {
      await logger.info(`⏩ Decision: Skip Document AI (disabled in configuration)`);
      await logger.info(`   → Paperless will handle OCR with Tesseract`);
      await logger.info(``);
    } else if (exceedsLimits(pdfInfo, maxPages, maxSizeMB)) {
      await logger.info(`⏩ Decision: Skip Document AI (exceeds configured limits)`);
      await logger.info(`   → Document: ${pdfInfo.pages} pages, ${pdfInfo.sizeMB.toFixed(2)} MB`);
      await logger.info(`   → Limits: ${maxPages} pages, ${maxSizeMB} MB`);
      await logger.info(`   → Paperless will handle OCR with Tesseract`);
      await logger.info(``);
    } else {
      // CRITICAL: Check monthly limit BEFORE processing
      await logger.info(`💰 Checking monthly Document AI budget...`);
      const limitCheck = await canProcessWithDocumentAI(pdfInfo.pages);
      if (!limitCheck.allowed) {
        await logger.warn(`⚠️  Decision: Skip Document AI (monthly limit reached)`);
        await logger.warn(`   → Reason: ${limitCheck.reason}`);
        await logger.info(`   → Paperless will handle OCR with Tesseract`);
        await logger.info(``);
        // Continue without Document AI
      } else {
        await logger.info(`✅ Monthly budget check passed: ${limitCheck.reason}`);
        await logger.info(``);

        // CRITICAL: Reserve pages BEFORE API call to ensure limit is not exceeded
        await logger.info(`🔒 Reserving ${pdfInfo.pages} pages from monthly budget...`);
        const reserved = await reserveDocumentAIPages(pdfInfo.pages);
        if (!reserved) {
          await logger.error(`❌ Failed to reserve Document AI pages, skipping`);
          await logger.info(`   → Paperless will handle OCR with Tesseract`);
          await logger.info(``);
        } else {
          await logger.info(`✅ Reserved ${pdfInfo.pages} pages from monthly budget`);
          await logger.info(``);

          // Update status
          await logger.info(`💾 Updating document status to PREPROCESSING...`);
          await prisma.document.update({
            where: { id: documentId },
            data: { status: 'PREPROCESSING', ocrPageCount: pdfInfo.pages },
          });
          await logger.info(`✅ Status updated: PREPROCESSING`);
          await logger.info(`   → OCR page count: ${pdfInfo.pages}`);
          await logger.info(``);

          // Step 1: Detect and rotate if needed
          await logger.info(`🔄 Step 1: Detecting page orientation...`);
          const [rotated, wasRotated, totalPages] = await detectAndRotatePDF(processingPath);
          if (wasRotated) {
            rotatedPath = rotated;
            finalPath = rotated;
            rotatedPagesCount = totalPages;
            await logger.info(`✅ ${totalPages} page(s) rotated to correct orientation`);
            await logger.info(`   → Rotated file: ${rotatedPath}`);
          } else {
            await logger.info(`✅ Page orientation correct, no rotation needed`);
          }
          await logger.info(``);

          // Step 2: Remove existing OCR layer
          await logger.info(`🧹 Step 2: Removing existing OCR layer...`);
          noOCRPath = await removeOCRLayer(finalPath);
          finalPath = noOCRPath;
          ocrLayerRemoved = true;
          await logger.info(`✅ OCR layer removed successfully`);
          await logger.info(`   → Clean PDF: ${noOCRPath}`);
          await logger.info(``);

          // Update status
          await logger.info(`💾 Updating document status to OCR_IN_PROGRESS...`);
          await prisma.document.update({
            where: { id: documentId },
            data: { status: 'OCR_IN_PROGRESS' },
          });
          await logger.info(`✅ Status updated: OCR_IN_PROGRESS`);
          await logger.info(``);

          // Step 3: Process with Document AI
          await logger.info(`🤖 Step 3: Sending document to Google Document AI...`);
          await logger.info(`   → Pages to process: ${pdfInfo.pages}`);
          await logger.info(`   → API call starting...`);
          const startTime = Date.now();
          const docAIResult = await processWithDocumentAI(finalPath);
          const duration = ((Date.now() - startTime) / 1000).toFixed(2);
          usedDocumentAI = true;
          await logger.info(`✅ Document AI processing complete`);
          await logger.info(`   → Duration: ${duration} seconds`);
          await logger.info(`   → Text extracted: ${docAIResult.text?.length || 0} characters`);
          await logger.info(``);

          // Step 4: Create searchable PDF
          await logger.info(`📝 Step 4: Creating searchable PDF with OCR layer...`);
          searchablePath = join(PROCESSING_DIR, fileName.replace('.pdf', '_searchable.pdf'));
          await createSearchablePDF(finalPath, docAIResult, searchablePath);
          finalPath = searchablePath;
          searchablePdfCreated = true;
          await logger.info(`✅ Searchable PDF created successfully`);
          await logger.info(`   → Output: ${searchablePath}`);
          await logger.info(``);

          // Update status
          await logger.info(`💾 Updating document status to OCR_COMPLETE...`);
          await prisma.document.update({
            where: { id: documentId },
            data: { status: 'OCR_COMPLETE' },
          });
          await logger.info(`✅ Status updated: OCR_COMPLETE`);
          await logger.info(``);
        }
      }
    }

    // Upload to Paperless
    await logger.info(`📤 Uploading to Paperless-NGX...`);
    await logger.info(`   → File: ${finalPath}`);
    await logger.info(`   → Tags: [${aiTodoTag}]`);
    await logger.info(``);

    await logger.info(`💾 Updating document status to UPLOADING_TO_PAPERLESS...`);
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'UPLOADING_TO_PAPERLESS' },
    });
    await logger.info(`✅ Status updated: UPLOADING_TO_PAPERLESS`);
    await logger.info(``);

    await logger.info(`🚀 Starting Paperless upload...`);
    const paperless = await getPaperlessClient();
    const uploadStartTime = Date.now();
    const paperlessId = await paperless.uploadDocument(finalPath, [aiTodoTag]);
    const uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(2);

    if (paperlessId) {
      await logger.info(`✅ Successfully uploaded to Paperless`);
      await logger.info(`   → Paperless Document ID: ${paperlessId}`);
      await logger.info(`   → Upload duration: ${uploadDuration} seconds`);
      await logger.info(`   → Tag added: ${aiTodoTag}`);
    } else {
      await logger.warn(`⚠️  Upload completed but Document ID not retrieved`);
      await logger.warn(`   → Possible causes:`);
      await logger.warn(`     - waitForTask() timeout`);
      await logger.warn(`     - Paperless async processing delay`);
      await logger.warn(`   → Document likely exists in Paperless`);
      await logger.warn(`   → Manual verification recommended`);
    }
    await logger.info(``);

    // Update final status with processing details
    await logger.info(`💾 Updating final document status to COMPLETED...`);
    const processingDetails = {
      rotatedPages: rotatedPagesCount,
      usedDocumentAI,
      ocrLayerRemoved,
      searchablePdfCreated,
      directToPaperless: !usedDocumentAI,
    };
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'COMPLETED',
        paperlessId: paperlessId,
        processingDetails: JSON.stringify(processingDetails),
      },
    });
    await logger.info(`✅ Status updated: COMPLETED`);
    if (paperlessId) {
      await logger.info(`   → Paperless ID: ${paperlessId}`);
    }
    await logger.info(`   → Processing details saved`);
    await logger.info(``);

    // Send success email notification
    if (paperlessId) {
      try {
        await sendDocumentProcessedEmail(fileName, paperlessId, 0); // TODO: Track actual tokens used
        await logger.info(`📧 Success email notification sent`);
      } catch (emailError: any) {
        await logger.warn(`Failed to send success email: ${emailError.message}`);
      }
    }

    await logger.info(`🎉 ========================================`);
    await logger.info(`🎉 DOCUMENT PROCESSING COMPLETE`);
    await logger.info(`🎉 ========================================`);
    await logger.info(`   → File: ${fileName}`);
    await logger.info(`   → Document ID: ${documentId}`);
    await logger.info(`   → Paperless ID: ${paperlessId || 'pending'}`);
    await logger.info(`   → Hash: ${fileHash.substring(0, 16)}...`);
    await logger.info(`🎉 ========================================`);
    await logger.info(``);

    // Cleanup temporary files
    await logger.info(`🧹 Cleaning up temporary files...`);
    let cleanupCount = 0;
    if (rotatedPath && existsSync(rotatedPath)) {
      unlinkSync(rotatedPath);
      await logger.info(`   → Deleted: ${rotatedPath}`);
      cleanupCount++;
    }
    if (noOCRPath && existsSync(noOCRPath)) {
      unlinkSync(noOCRPath);
      await logger.info(`   → Deleted: ${noOCRPath}`);
      cleanupCount++;
    }
    if (searchablePath && existsSync(searchablePath)) {
      unlinkSync(searchablePath);
      await logger.info(`   → Deleted: ${searchablePath}`);
      cleanupCount++;
    }
    if (processingPath && existsSync(processingPath)) {
      unlinkSync(processingPath);
      await logger.info(`   → Deleted: ${processingPath}`);
      cleanupCount++;
    }
    await logger.info(`✅ Cleanup complete: ${cleanupCount} temporary file(s) removed`);
    await logger.info(``);

  } catch (error: any) {
    await logger.error(`❌ ========================================`);
    await logger.error(`❌ ERROR PROCESSING DOCUMENT`);
    await logger.error(`❌ ========================================`);
    await logger.error(`   → File: ${fileName}`);
    await logger.error(`   → Document ID: ${documentId || 'not created'}`);
    await logger.error(`   → Error: ${error.message}`);
    await logger.error(`   → Type: ${error.constructor.name}`);
    await logger.error(``);
    await logger.error(`Stack trace:`);
    if (error.stack) {
      const stackLines = error.stack.split('\n').slice(0, 10);
      for (const line of stackLines) {
        await logger.error(`   ${line}`);
      }
    }
    await logger.error(`❌ ========================================`);
    await logger.error(``);

    // Update document status
    if (documentId) {
      await logger.info(`💾 Updating document status to ERROR...`);
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'ERROR',
          errorMessage: error.message || 'Unknown error',
        },
      });
      await logger.info(`✅ Status updated: ERROR`);
      await logger.info(`   → Error message saved to database`);
      await logger.info(``);

      // Send error email notification
      try {
        await sendDocumentErrorEmail(fileName, error.message || 'Unknown error', documentId);
        await logger.info(`📧 Error email notification sent`);
      } catch (emailError: any) {
        await logger.warn(`Failed to send error email: ${emailError.message}`);
      }
    }

    // Move to error directory
    try {
      await logger.info(`📁 Moving file to error directory...`);
      const errorPath = join(ERROR_DIR, fileName);

      // Try to move the file from processing if it exists
      if (processingPath && existsSync(processingPath)) {
        copyFileSync(processingPath, errorPath);
        unlinkSync(processingPath);
        await logger.info(`✅ File moved to error directory: ${errorPath}`);
      } else if (existsSync(filePath)) {
        copyFileSync(filePath, errorPath);
        unlinkSync(filePath);
        await logger.info(`✅ File moved to error directory: ${errorPath}`);
      } else {
        await logger.warn(`⚠️  Original file not found, could not move to error directory`);
      }
      await logger.info(``);

      // Cleanup temporary files
      await logger.info(`🧹 Cleaning up temporary files after error...`);
      let cleanupCount = 0;
      if (rotatedPath && existsSync(rotatedPath)) {
        unlinkSync(rotatedPath);
        await logger.info(`   → Deleted: ${rotatedPath}`);
        cleanupCount++;
      }
      if (noOCRPath && existsSync(noOCRPath)) {
        unlinkSync(noOCRPath);
        await logger.info(`   → Deleted: ${noOCRPath}`);
        cleanupCount++;
      }
      if (searchablePath && existsSync(searchablePath)) {
        unlinkSync(searchablePath);
        await logger.info(`   → Deleted: ${searchablePath}`);
        cleanupCount++;
      }
      await logger.info(`✅ Cleanup complete: ${cleanupCount} temporary file(s) removed`);
      await logger.info(``);

    } catch (moveError) {
      await logger.error(`❌ Failed to move file to error directory:`, moveError);
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

  // Clean up orphaned documents (documents in processing state but files don't exist)
  await cleanupOrphanedDocuments();

  await logger.info(`Starting worker, watching: ${CONSUME_DIR}`);

  watcher = watch(CONSUME_DIR, {
    ignored: /^\./,
    persistent: true,
    ignoreInitial: false, // Process existing files on startup
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }, // Wait for file to be fully written/moved
  });

  watcher.on('add', async (path: string) => {
    await logger.info(`Chokidar: File detected: ${path}`);
    if (path.toLowerCase().endsWith('.pdf')) {
      await logger.info(`Chokidar: Processing PDF: ${path}`);
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
