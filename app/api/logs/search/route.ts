import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * Search logs in database
 * Searches through ALL logs, not just recent ones
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const mode = searchParams.get('mode') || 'OR'; // AND or OR
    const limit = parseInt(searchParams.get('limit') || '1000');

    if (!query.trim()) {
      return NextResponse.json({
        logs: [],
        total: 0,
        message: 'No search query provided',
      });
    }

    // Split search query into terms
    const searchTerms = query.toLowerCase().trim().split(/\s+/);

    // Get all logs first, then filter by timestamp in JavaScript
    // (Prisma/SQLite doesn't support searching in formatted date strings)
    const allLogs = await prisma.log.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Filter logs that match search terms
    const matchedLogs = allLogs.filter(log => {
      // Format timestamp as searchable string (YYYY-MM-DD HH:mm:ss)
      const timestampStr = log.createdAt.toISOString().replace('T', ' ').substring(0, 19).toLowerCase();
      const logText = `${timestampStr} ${log.message} ${log.level} ${log.meta || ''}`.toLowerCase();

      if (mode === 'AND') {
        // All terms must match
        return searchTerms.every(term => logText.includes(term));
      } else {
        // At least one term must match
        return searchTerms.some(term => logText.includes(term));
      }
    });

    // Take only the requested limit
    const logs = matchedLogs.slice(0, limit);

    // Get total count
    const total = matchedLogs.length;

    // Format logs for frontend
    const formattedLogs = logs.map(log => ({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      level: log.level,
      source: extractSource(log.message),
      message: log.message,
      meta: log.meta,
    }));

    return NextResponse.json({
      logs: formattedLogs,
      total,
      limit,
      showing: formattedLogs.length,
    });
  } catch (error: any) {
    console.error('[Log Search] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to search logs',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

function extractSource(message: string): string {
  if (message.includes('[Upload]')) return 'upload';
  if (message.includes('[FTP]')) return 'ftp';
  if (message.includes('[Email]') || message.includes('[SMTP]')) return 'email';
  if (message.includes('[Worker]')) return 'worker';
  if (message.includes('[Middleware]')) return 'middleware';
  if (message.includes('[Paperless]')) return 'paperless';
  if (message.includes('[OAuth]')) return 'oauth';
  if (message.includes('[Gemini]')) return 'gemini';
  if (message.includes('[AI Polling]') || message.includes('[Polling]')) return 'polling';
  if (message.includes('[ProcessLock]')) return 'lock';
  if (message.includes('[INFO]') && message.includes('framework')) return 'framework';
  if (message.includes('Next.js')) return 'next.js';
  return 'system';
}
