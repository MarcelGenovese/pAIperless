import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export const runtime = 'nodejs';

const logger = createLogger('DocumentRetryDuplicate');

/**
 * Retry a document that failed due to duplicate detection
 * This will:
 * 1. Generate a new hash for the document to bypass duplicate check
 * 2. Move the file from /error back to /consume
 * 3. Update the database record
 *
 * POST /api/documents/retry-duplicate
 * Body: { documentId: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID required' },
        { status: 400 }
      );
    }

    // Get the document
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Check if error message indicates duplicate
    const isDuplicate = document.errorMessage?.includes('Duplikat') ||
                        document.errorMessage?.includes('duplicate') ||
                        document.errorMessage?.includes('DUPLICATE');

    if (!isDuplicate) {
      return NextResponse.json(
        { error: 'This endpoint is only for duplicate errors. Use /api/documents/retry for other errors.' },
        { status: 400 }
      );
    }

    // Construct file path in error folder
    const errorFolderPath = '/app/storage/error';
    const fileName = document.originalFilename;
    const errorFilePath = path.join(errorFolderPath, fileName);

    // Check if file exists in error folder
    let fileExists = false;
    try {
      await fs.access(errorFilePath);
      fileExists = true;
    } catch (e) {
      // File doesn't exist, might have been moved or deleted
    }

    if (!fileExists) {
      return NextResponse.json(
        { error: 'File not found in error folder. It may have been moved or deleted.' },
        { status: 404 }
      );
    }

    // Generate a new unique hash by adding timestamp
    const timestamp = Date.now();
    const newHashSource = `${document.fileHash}-${timestamp}`;
    const newHash = crypto.createHash('sha256').update(newHashSource).digest('hex');

    await logger.info(`Retrying duplicate document ${documentId}: ${fileName}`);
    await logger.info(`Old hash: ${document.fileHash.substring(0, 16)}...`);
    await logger.info(`New hash: ${newHash.substring(0, 16)}...`);

    // Update document with new hash and reset status
    await prisma.document.update({
      where: { id: documentId },
      data: {
        fileHash: newHash,
        status: 'PENDING',
        errorMessage: null,
        filePath: null, // Will be set by worker
      }
    });

    // Move file from error back to consume
    const consumeFolderPath = '/app/storage/consume';
    const consumeFilePath = path.join(consumeFolderPath, fileName);

    await fs.rename(errorFilePath, consumeFilePath);
    await logger.info(`File moved from error to consume: ${fileName}`);

    return NextResponse.json({
      success: true,
      message: 'Document moved back to consume folder with new hash. Worker will reprocess it.',
      documentId,
      newHash: newHash.substring(0, 32) + '...'
    });

  } catch (error: any) {
    console.error('Failed to retry duplicate document:', error);
    await logger.error('Failed to retry duplicate document', error);
    return NextResponse.json(
      { error: 'Failed to retry document: ' + error.message },
      { status: 500 }
    );
  }
}
