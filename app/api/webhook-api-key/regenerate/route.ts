import { NextResponse } from 'next/server';
import { setConfig, CONFIG_KEYS } from '@/lib/config';
import { getPaperlessClient } from '@/lib/paperless';
import crypto from 'crypto';

export const runtime = 'nodejs';

/**
 * Regenerate the webhook API key and automatically update Paperless workflows
 */
export async function POST() {
  try {
    // Generate a new random API key
    const newApiKey = crypto.randomBytes(32).toString('hex');

    // Save the new key
    await setConfig(CONFIG_KEYS.WEBHOOK_API_KEY, newApiKey);

    console.log('[Webhook API Key] API key regenerated successfully');

    // Try to automatically update workflows
    let workflowUpdateResult = null;
    try {
      const client = await getPaperlessClient();
      workflowUpdateResult = await client.updateAllWorkflowApiKeys(newApiKey);

      if (workflowUpdateResult.success) {
        console.log(`[Webhook API Key] Updated ${workflowUpdateResult.updated} workflows automatically`);
      } else {
        console.warn(`[Webhook API Key] Failed to update some workflows:`, workflowUpdateResult.failed);
      }
    } catch (workflowError: any) {
      console.warn('[Webhook API Key] Could not automatically update workflows:', workflowError.message);
      workflowUpdateResult = {
        success: false,
        error: workflowError.message,
      };
    }

    return NextResponse.json({
      success: true,
      apiKey: newApiKey,
      message: 'Webhook API key regenerated successfully',
      workflowUpdate: workflowUpdateResult,
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
