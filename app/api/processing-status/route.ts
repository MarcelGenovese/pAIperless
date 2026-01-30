import { NextResponse } from 'next/server';
import { getAllLockStatus } from '@/lib/process-lock';

export const runtime = 'nodejs';

/**
 * Get current processing status of all processes
 * Used by the header to display active operations
 */
export async function GET() {
  try {
    const statuses = await getAllLockStatus();

    // Find active processes
    const activeProcesses = Object.entries(statuses)
      .filter(([_, lock]) => lock.status === 'running')
      .map(([type, lock]) => ({
        type,
        details: lock.details,
        startedAt: lock.startedAt,
        duration: lock.startedAt
          ? Math.floor((Date.now() - new Date(lock.startedAt).getTime()) / 1000)
          : 0,
      }));

    return NextResponse.json({
      hasActiveProcesses: activeProcesses.length > 0,
      activeProcesses,
      allStatuses: statuses,
    });
  } catch (error: any) {
    console.error('[Processing Status] Error:', error);
    return NextResponse.json(
      {
        hasActiveProcesses: false,
        activeProcesses: [],
        error: error.message,
      },
      { status: 500 }
    );
  }
}
