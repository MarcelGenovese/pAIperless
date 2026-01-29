import { NextRequest, NextResponse } from 'next/server';
import { getPaperlessClient } from '@/lib/paperless';

export const runtime = 'nodejs';

/**
 * Create a new custom field in Paperless
 */
export async function POST(request: NextRequest) {
  try {
    const { name, data_type } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Field name is required' },
        { status: 400 }
      );
    }

    if (!data_type) {
      return NextResponse.json(
        { error: 'Data type is required' },
        { status: 400 }
      );
    }

    const client = await getPaperlessClient();

    // Create custom field via Paperless API
    const response = await fetch(`${(client as any).baseUrl}/api/custom_fields/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${(client as any).token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name.trim(),
        data_type: data_type
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Paperless API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to create custom field:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create custom field' },
      { status: 500 }
    );
  }
}
