import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { paperlessUrl, paperlessToken } = await request.json();

    if (!paperlessUrl || !paperlessToken) {
      return NextResponse.json(
        { error: 'Missing paperlessUrl or paperlessToken' },
        { status: 400 }
      );
    }

    // Fetch workflows from Paperless-NGX
    const response = await fetch(`${paperlessUrl}/api/workflows/`, {
      headers: {
        'Authorization': `Token ${paperlessToken}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch workflows from Paperless-NGX' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const workflows = data.results || [];

    // Check for required webhooks
    const requiredWebhooks = [
      'paiperless_document_added',
      'paiperless_document_updated'
    ];

    const foundWebhooks = workflows.filter((workflow: any) =>
      requiredWebhooks.includes(workflow.name)
    );

    const webhooksExist = foundWebhooks.length === requiredWebhooks.length;

    if (webhooksExist) {
      return NextResponse.json({
        webhooksExist: true,
        message: 'All required webhooks are configured',
        foundWebhooks: foundWebhooks.map((w: any) => w.name)
      });
    } else {
      const missing = requiredWebhooks.filter(
        name => !foundWebhooks.find((w: any) => w.name === name)
      );

      return NextResponse.json({
        webhooksExist: false,
        message: `Missing webhooks: ${missing.join(', ')}`,
        foundWebhooks: foundWebhooks.map((w: any) => w.name),
        missingWebhooks: missing
      });
    }

  } catch (error: any) {
    console.error('Test webhooks error:', error);
    return NextResponse.json(
      {
        error: 'Failed to test webhooks',
        details: error.message
      },
      { status: 500 }
    );
  }
}
