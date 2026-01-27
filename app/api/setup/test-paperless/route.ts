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

    return NextResponse.json({
      success: true,
      message: workflowsExist
        ? 'Connection successful! All required workflows found.'
        : 'Connection successful! Please create the required workflows.',
      workflowsExist,
      missingWorkflows,
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
