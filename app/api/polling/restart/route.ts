import { NextResponse } from 'next/server';
import { restartAiTodoPolling } from '@/lib/polling';

export const runtime = 'nodejs';

/**
 * Restart AI_TODO polling with new settings
 * Called after polling settings are updated
 */
export async function POST() {
  try {
    await restartAiTodoPolling();

    return NextResponse.json({
      success: true,
      message: 'Polling restarted with new settings',
    });
  } catch (error: any) {
    console.error('[Polling Restart] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
