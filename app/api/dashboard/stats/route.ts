import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // Get total documents
    const totalDocuments = await prisma.document.count();

    // Get documents with COMPLETED status
    const completedDocuments = await prisma.document.count({
      where: { status: 'COMPLETED' },
    });

    // Get pending actions (would come from Paperless API in real implementation)
    // For now, use documents with ACTION_REQUIRED status
    const pendingActions = await prisma.document.count({
      where: { status: 'ACTION_REQUIRED' },
    });

    // Get API calls this month (from logs or a counter table)
    // For now, estimate based on processed documents
    const apiCalls = completedDocuments * 2; // Rough estimate: 1 Document AI + 1 Gemini call per doc

    // Check if any documents are currently processing
    const processingDocuments = await prisma.document.count({
      where: {
        status: {
          in: ['PENDING', 'PREPROCESSING_COMPLETE', 'OCR_IN_PROGRESS'],
        },
      },
    });

    const processingStatus = processingDocuments > 0 ? 'processing' : 'idle';

    return NextResponse.json({
      totalDocuments,
      pendingActions,
      apiCalls,
      processingStatus,
    });
  } catch (error: any) {
    console.error('Failed to get dashboard stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get stats' },
      { status: 500 }
    );
  }
}
