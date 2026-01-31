import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { existsSync } from 'fs';
import { createLogger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const logger = createLogger('CleanupOrphaned');

/**
 * Clean up orphaned documents in database
 * Documents with PENDING/PROCESSING status but no file in filesystem
 * POST /api/documents/cleanup-orphaned
 */
export async function POST() {
  try {
    await logger.info('Starting orphaned documents cleanup');

    // Find all documents that are in processing state
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

    await logger.info(`Found ${processingDocs.length} documents in processing state`);

    let cleaned = 0;
    const cleanedDocs: Array<{ id: number; filename: string }> = [];

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
        cleanedDocs.push({
          id: doc.id,
          filename: doc.originalFilename
        });
      }
    }

    await logger.info(`Cleanup complete: ${cleaned} orphaned documents marked as ERROR`);

    return NextResponse.json({
      success: true,
      cleaned,
      documents: cleanedDocs,
      message: `${cleaned} verwaiste Dokument(e) wurden bereinigt`
    });

  } catch (error: any) {
    await logger.error('Failed to cleanup orphaned documents', error);
    return NextResponse.json(
      { error: 'Failed to cleanup orphaned documents', details: error.message },
      { status: 500 }
    );
  }
}
