import { NextRequest, NextResponse } from 'next/server';
import { getPaperlessClient } from '@/lib/paperless';

export const runtime = 'nodejs';

/**
 * Create a new tag in Paperless
 */
export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Tag name is required' },
        { status: 400 }
      );
    }

    const client = await getPaperlessClient();

    // Create tag via Paperless API
    const response = await fetch(`${(client as any).baseUrl}/api/tags/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${(client as any).token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: name.trim() }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Paperless API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to create tag:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create tag' },
      { status: 500 }
    );
  }
}
