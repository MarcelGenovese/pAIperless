import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * Clear pending/processing documents from database
 * Removes documents that are stuck in intermediate states
 */
export async function POST() {
  try {
    // Delete documents with status PENDING, PREPROCESSING, OCR_IN_PROGRESS, UPLOADING_TO_PAPERLESS
    const result = await prisma.document.deleteMany({
      where: {
        status: {
          in: ['PENDING', 'PREPROCESSING', 'OCR_IN_PROGRESS', 'UPLOADING_TO_PAPERLESS']
        }
      }
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `${result.count} ausstehende(s) Dokument(e) gelöscht`
    });
  } catch (error: any) {
    console.error('[Maintenance/Clear-Pending] Error:', error);
    return NextResponse.json(
      { error: 'Fehler beim Bereinigen: ' + error.message },
      { status: 500 }
    );
  }
}
