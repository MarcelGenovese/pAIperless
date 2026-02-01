import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPaperlessClient } from '@/lib/paperless';
import { getConfig, CONFIG_KEYS } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get total documents
    const totalDocuments = await prisma.document.count();

    // Get documents with COMPLETED status
    const completedDocuments = await prisma.document.count({
      where: { status: 'COMPLETED' },
    });

    // Get pending actions from Paperless API using configured tag
    let pendingActions = 0;
    try {
      const paperlessClient = await getPaperlessClient();
      const tagActionRequiredName = await getConfig(CONFIG_KEYS.TAG_ACTION_REQUIRED) || 'action_required';
      const tagId = await paperlessClient.getTagId(tagActionRequiredName);

      if (tagId) {
        const actionDocuments = await paperlessClient.getDocumentsByTag(tagId);
        pendingActions = actionDocuments.length;
      }
    } catch (error) {
      console.error('[Stats] Failed to get pending actions from Paperless:', error);
      // Fall back to 0 if Paperless is not accessible
      pendingActions = 0;
    }

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
