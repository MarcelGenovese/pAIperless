import { NextRequest, NextResponse } from 'next/server';
import { getPaperlessClient } from '@/lib/paperless';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

/**
 * POST /api/webhooks/create-workflows
 * Automatically create pAIperless webhooks in Paperless-NGX
 */
export async function POST(request: NextRequest) {
  try {
    const webhookApiKey = await getConfig('WEBHOOK_API_KEY');
    const paiperlessUrl = await getConfig('PAIPERLESS_BASE_URL');

    if (!webhookApiKey) {
      return NextResponse.json({
        success: false,
        error: 'Webhook API key not configured',
      }, { status: 500 });
    }

    // Auto-detect pAIperless URL if not configured
    let baseUrl = paiperlessUrl;
    if (!baseUrl) {
      // Try to get from request headers
      const host = request.headers.get('host');
      const protocol = request.headers.get('x-forwarded-proto') || 'http';
      baseUrl = `${protocol}://${host}`;
    }

    const client = await getPaperlessClient();
    const result = await client.createPaiperlessWorkflows(webhookApiKey, baseUrl);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Workflow Creation] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
