import { NextResponse } from 'next/server';
import { cleanAllLogs } from '@/lib/log-cleaner';

export const runtime = 'nodejs';

/**
 * Manual log cleanup endpoint
 * DELETE /api/logs/cleanup - Clean old logs
 * GET /api/logs/cleanup?preview=true - Preview how many logs would be deleted
 */
export async function DELETE() {
  try {
    const result = await cleanAllLogs();

    return NextResponse.json({
      success: true,
      message: `Cleaned ${result.database} database entries and ${result.filesystem} filesystem files`,
      database: result.database,
      filesystem: result.filesystem,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to clean logs', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Preview cleanup (count only, no deletion)
 */
export async function GET() {
  try {
    const { prisma } = await import('@/lib/prisma');

    // Count logs older than 28 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 28);

    const count = await prisma.log.count({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `${count} log entries would be deleted (older than 28 days)`,
      count,
      cutoffDate: cutoffDate.toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to preview cleanup', details: error.message },
      { status: 500 }
    );
  }
}
