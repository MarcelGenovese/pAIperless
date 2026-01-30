import { NextRequest, NextResponse } from 'next/server';
import { getPaperlessClient } from '@/lib/paperless';
import { getConfig } from '@/lib/config';

/**
 * GET /api/webhooks/validate
 * Check if webhook API keys in Paperless workflows match the current key
 */
export async function GET(request: NextRequest) {
  try {
    const webhookApiKey = await getConfig('WEBHOOK_API_KEY');

    if (!webhookApiKey) {
      return NextResponse.json({
        valid: false,
        error: 'Webhook API key not configured',
      }, { status: 500 });
    }

    const client = await getPaperlessClient();
    const result = await client.checkWorkflowApiKeys(webhookApiKey);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Webhook Validation] Error:', error);
    return NextResponse.json({
      valid: false,
      error: error.message,
    }, { status: 500 });
  }
}
