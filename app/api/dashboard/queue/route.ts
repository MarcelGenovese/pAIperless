import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * Get document processing queue status
 * Returns counts of documents by status
 */
export async function GET() {
  try {
    // Get counts by status
    const [pending, processing, error, completed] = await Promise.all([
      prisma.document.count({
        where: {
          status: {
            in: ['PENDING', 'PENDING_CONFIGURATION']
          }
        }
      }),
      prisma.document.count({
        where: {
          status: {
            in: ['PREPROCESSING', 'OCR_IN_PROGRESS', 'OCR_COMPLETE', 'UPLOADING_TO_PAPERLESS']
          }
        }
      }),
      prisma.document.count({
        where: {
          status: 'ERROR'
        }
      }),
      prisma.document.count({
        where: {
          status: 'COMPLETED'
        }
      })
    ]);

    // Get recent error documents for display
    const errorDocuments = await prisma.document.findMany({
      where: {
        status: 'ERROR'
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 5,
      select: {
        id: true,
        originalFilename: true,
        errorMessage: true,
        updatedAt: true,
        paperlessId: true,
      }
    });

    // Get pending documents
    const pendingDocuments = await prisma.document.findMany({
      where: {
        status: {
          in: ['PENDING', 'PENDING_CONFIGURATION']
        }
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: 5,
      select: {
        id: true,
        originalFilename: true,
        createdAt: true,
        paperlessId: true,
      }
    });

    // Get processing documents
    const processingDocuments = await prisma.document.findMany({
      where: {
        status: {
          in: ['PREPROCESSING', 'OCR_IN_PROGRESS', 'OCR_COMPLETE', 'UPLOADING_TO_PAPERLESS']
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 5,
      select: {
        id: true,
        originalFilename: true,
        status: true,
        updatedAt: true,
        paperlessId: true,
      }
    });

    return NextResponse.json({
      counts: {
        pending,
        processing,
        error,
        completed,
      },
      documents: {
        pending: pendingDocuments,
        processing: processingDocuments,
        error: errorDocuments,
      }
    });
  } catch (error: any) {
    console.error('Failed to fetch queue status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch queue status' },
      { status: 500 }
    );
  }
}
