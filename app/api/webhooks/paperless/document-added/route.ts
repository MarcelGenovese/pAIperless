import { NextRequest, NextResponse } from 'next/server';
import { getConfig, CONFIG_KEYS } from '@/lib/config';
import { processAiTodoDocuments } from '@/lib/polling';

export const runtime = 'nodejs';

/**
 * Webhook endpoint for Paperless document-added events
 * This is triggered by Paperless workflows when new documents are added
 *
 * Workflow: paiperless_document_added
 * - Trigger: Document added
 * - Action: POST to this endpoint
 * - Header: x-api-key: {WEBHOOK_API_KEY}
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Validate webhook API key
    const apiKey = request.headers.get('x-api-key');
    const expectedApiKey = await getConfig(CONFIG_KEYS.WEBHOOK_API_KEY);

    if (!apiKey || !expectedApiKey || apiKey !== expectedApiKey) {
      console.error('[Webhook] Invalid API key');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Webhook] Document added webhook triggered');

    // 2. Process AI_TODO documents using shared function
    const result = await processAiTodoDocuments();

    const totalTokens = result.results.reduce((sum, r) => sum + (r.tokensUsed || 0), 0);

    return NextResponse.json({
      message: 'Documents processed',
      total: result.total,
      successful: result.successful,
      failed: result.failed,
      totalTokensUsed: totalTokens,
      results: result.results,
    });
  } catch (error: any) {
    console.error('[Webhook] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
