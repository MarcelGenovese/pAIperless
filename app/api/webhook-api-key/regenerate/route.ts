import { NextResponse } from 'next/server';
import { setConfig, CONFIG_KEYS } from '@/lib/config';
import crypto from 'crypto';

export const runtime = 'nodejs';

/**
 * Regenerate the webhook API key
 */
export async function POST() {
  try {
    // Generate a new random API key
    const newApiKey = crypto.randomBytes(32).toString('hex');

    // Save the new key
    await setConfig(CONFIG_KEYS.WEBHOOK_API_KEY, newApiKey);

    console.log('[Webhook API Key] API key regenerated successfully');

    return NextResponse.json({
      success: true,
      apiKey: newApiKey,
      message: 'Webhook API key regenerated successfully',
    });
  } catch (error: any) {
    console.error('[Webhook API Key] Error regenerating key:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to regenerate API key',
      },
      { status: 500 }
    );
  }
}
