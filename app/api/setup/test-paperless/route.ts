import { NextRequest, NextResponse } from 'next/server';
import { setConfig, setConfigSecure, getConfig, CONFIG_KEYS } from '@/lib/config';
import { generateSecureToken } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    // Try to get from request body first, then fall back to config
    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      // No body provided, will use config
    }

    let paperlessUrl = body.paperlessUrl;
    let paperlessToken = body.paperlessToken;

    // If not provided in request, try to get from config
    if (!paperlessUrl) {
      paperlessUrl = await getConfig(CONFIG_KEYS.PAPERLESS_URL);
    }
    if (!paperlessToken) {
      const { getConfigSecure } = await import('@/lib/config');
      paperlessToken = await getConfigSecure(CONFIG_KEYS.PAPERLESS_TOKEN);
    }

    if (!paperlessUrl || !paperlessToken) {
      return NextResponse.json(
        { error: 'Missing paperlessUrl or paperlessToken in request or config' },
        { status: 400 }
      );
    }

    // Test connection to Paperless API
    const baseUrl = paperlessUrl.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/api/documents/`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${paperlessToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Paperless API returned ${response.status}: ${response.statusText}`,
        },
        { status: 400 }
      );
    }

    // Check if required workflows exist
    const workflowsResponse = await fetch(`${baseUrl}/api/workflows/`, {
      headers: {
        'Authorization': `Token ${paperlessToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    const requiredWorkflows = [
      'paiperless_document_added',
      'paiperless_document_updated',
    ];

    let workflowsExist = true;
    let missingWorkflows: string[] = [];

    if (workflowsResponse.ok) {
      const workflows = await workflowsResponse.json();
      const workflowNames = workflows.results?.map((w: any) => w.name) || [];

      missingWorkflows = requiredWorkflows.filter(
        (name) => !workflowNames.includes(name)
      );

      if (missingWorkflows.length > 0) {
        workflowsExist = false;
      }
    }

    // Save configuration
    await setConfig(CONFIG_KEYS.PAPERLESS_URL, paperlessUrl);
    await setConfigSecure(CONFIG_KEYS.PAPERLESS_TOKEN, paperlessToken);

    // Generate or retrieve webhook API key
    let webhookApiKey = await getConfig(CONFIG_KEYS.WEBHOOK_API_KEY);
    if (!webhookApiKey) {
      webhookApiKey = generateSecureToken(32);
      await setConfig(CONFIG_KEYS.WEBHOOK_API_KEY, webhookApiKey);
      console.log('Generated new webhook API key');
    } else {
      console.log('Using existing webhook API key');
    }

    return NextResponse.json({
      success: true,
      message: workflowsExist
        ? 'Connection successful! All required workflows found.'
        : 'Connection successful! Please create the required workflows.',
      workflowsExist,
      missingWorkflows,
      webhookApiKey,
    });
  } catch (error: any) {
    console.error('Paperless connection test failed:', error);

    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Connection timeout. Please check the URL and network.' },
        { status: 408 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to connect to Paperless' },
      { status: 500 }
    );
  }
}
