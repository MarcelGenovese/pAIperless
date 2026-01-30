import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';

export const runtime = 'nodejs';

const logger = createLogger('DocumentRetry');

/**
 * Retry failed document processing
 * POST /api/documents/retry
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

    // Reset status to PENDING to trigger reprocessing
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'PENDING',
        errorMessage: null,
      }
    });

    await logger.info(`Document ${documentId} (${document.originalFilename}) reset for retry`);

    return NextResponse.json({
      success: true,
      message: 'Document queued for reprocessing'
    });
  } catch (error: any) {
    console.error('Failed to retry document:', error);
    await logger.error('Failed to retry document', error);
    return NextResponse.json(
      { error: 'Failed to retry document' },
      { status: 500 }
    );
  }
}

/**
 * Retry multiple documents at once
 * POST /api/documents/retry-batch
 * Body: { documentIds: number[] }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentIds } = body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { error: 'Document IDs array required' },
        { status: 400 }
      );
    }

    // Reset all documents to PENDING
    const result = await prisma.document.updateMany({
      where: {
        id: { in: documentIds },
        status: 'ERROR'
      },
      data: {
        status: 'PENDING',
        errorMessage: null,
      }
    });

    await logger.info(`Reset ${result.count} documents for retry`);

    return NextResponse.json({
      success: true,
      count: result.count,
      message: `${result.count} documents queued for reprocessing`
    });
  } catch (error: any) {
    console.error('Failed to retry documents:', error);
    await logger.error('Failed to retry documents', error);
    return NextResponse.json(
      { error: 'Failed to retry documents' },
      { status: 500 }
    );
  }
}
