import { NextRequest, NextResponse } from 'next/server';
import { getPaperlessClient } from '@/lib/paperless';
import { getConfig } from '@/lib/config';

/**
 * POST /api/webhooks/update-workflows
 * Update webhook API keys in all pAIperless workflows
 */
export async function POST(request: NextRequest) {
  try {
    const webhookApiKey = await getConfig('WEBHOOK_API_KEY');

    if (!webhookApiKey) {
      return NextResponse.json({
        success: false,
        error: 'Webhook API key not configured',
      }, { status: 500 });
    }

    const client = await getPaperlessClient();
    const result = await client.updateAllWorkflowApiKeys(webhookApiKey);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Webhook Update] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
