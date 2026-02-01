import { NextResponse } from 'next/server';
import { processCompletedTasks } from '@/lib/action-polling';

export const runtime = 'nodejs';

/**
 * Manually trigger action polling (completed task check)
 * This allows users to immediately sync completed tasks instead of waiting for the polling interval
 */
export async function POST() {
  try {
    console.log('[Action Polling Trigger] Manual trigger requested');

    // Process completed tasks
    const result = await processCompletedTasks();

    console.log('[Action Polling Trigger] Processing complete:', result);

    return NextResponse.json({
      success: true,
      ...result,
      message: `Verarbeitet: ${result.processed} von ${result.total} Tasks`
    });
  } catch (error: any) {
    console.error('[Action Polling Trigger] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Fehler beim Verarbeiten'
      },
      { status: 500 }
    );
  }
}
