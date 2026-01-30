import { NextResponse } from 'next/server';
import { getConfig, CONFIG_KEYS } from '@/lib/config';

export const runtime = 'nodejs';

/**
 * Get the current webhook API key
 */
export async function GET() {
  try {
    const apiKey = await getConfig(CONFIG_KEYS.WEBHOOK_API_KEY);

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Webhook API key not configured' },
        { status: 404 }
      );
    }

    return NextResponse.json({ apiKey });
  } catch (error: any) {
    console.error('[Webhook API Key] Error fetching key:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API key' },
      { status: 500 }
    );
  }
}
