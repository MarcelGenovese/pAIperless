import { watch } from 'chokidar';
import { createHash } from 'crypto';
import { readFileSync, renameSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { prisma } from './prisma';
import { processWithDocumentAI } from './google';
import { getPaperlessClient } from './paperless';

const CONSUME_DIR = process.env.CONSUME_DIR || '/app/consume';
const PROCESSING_DIR = process.env.PROCESSING_DIR || '/app/processing';
const ERROR_DIR = process.env.ERROR_DIR || '/app/error';

// Ensure directories exist
[CONSUME_DIR, PROCESSING_DIR, ERROR_DIR].forEach(dir => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

function calculateFileHash(filePath: string): string {
  const buffer = readFileSync(filePath);
  return createHash('sha256').update(buffer).digest('hex');
}

async function processFile(filePath: string) {
  const fileName = filePath.split('/').pop() || 'unknown';
  console.log(`Processing file: ${fileName}`);

  try {
    // Calculate hash
    const fileHash = calculateFileHash(filePath);

    // Check for duplicates
    const existing = await prisma.document.findUnique({
      where: { fileHash },
    });

    if (existing) {
      console.log(`Duplicate file detected: ${fileName}`);
      renameSync(filePath, join(ERROR_DIR, fileName));
      return;
    }

    // Move to processing
    const processingPath = join(PROCESSING_DIR, fileName);
    renameSync(filePath, processingPath);

    // Create document record
    const document = await prisma.document.create({
      data: {
        originalFilename: fileName,
        fileHash,
        filePath: processingPath,
        status: 'PENDING',
      },
    });

    // Process with Document AI
    console.log(`Running OCR on ${fileName}...`);
    await prisma.document.update({
      where: { id: document.id },
      data: { status: 'OCR_IN_PROGRESS' },
    });

    const ocrText = await processWithDocumentAI(processingPath);

    await prisma.document.update({
      where: { id: document.id },
      data: { status: 'OCR_COMPLETE' },
    });

    // Upload to Paperless
    console.log(`Uploading ${fileName} to Paperless...`);
    const paperless = await getPaperlessClient();
    const documentId = await paperless.uploadDocument(processingPath, ['ai_todo']);

    await prisma.document.update({
      where: { id: document.id },
      data: {
        status: 'COMPLETED',
        paperlessId: documentId,
      },
    });

    console.log(`Successfully processed: ${fileName}`);
  } catch (error: any) {
    console.error(`Error processing ${fileName}:`, error);

    // Move to error directory
    try {
      const errorPath = join(ERROR_DIR, fileName);
      if (existsSync(join(PROCESSING_DIR, fileName))) {
        renameSync(join(PROCESSING_DIR, fileName), errorPath);
      }
    } catch (moveError) {
      console.error(`Failed to move file to error directory:`, moveError);
    }
  }
}

let watcher: any = null;

export function startWorker() {
  if (watcher) {
    console.log('Worker already running');
    return;
  }

  console.log(`Starting worker, watching: ${CONSUME_DIR}`);

  watcher = watch(CONSUME_DIR, {
    ignored: /^\./,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100,
    },
  });

  watcher.on('add', (path: string) => {
    if (path.toLowerCase().endsWith('.pdf')) {
      processFile(path);
    }
  });

  watcher.on('error', (error: Error) => {
    console.error('Watcher error:', error);
  });

  console.log('Worker started successfully');
}

export function stopWorker() {
  if (watcher) {
    watcher.close();
    watcher = null;
    console.log('Worker stopped');
  }
}
