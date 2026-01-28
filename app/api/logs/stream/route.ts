import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * WebSocket endpoint for streaming live logs
 *
 * This endpoint uses Server-Sent Events (SSE) as a fallback since
 * Next.js API routes don't support WebSockets directly.
 * For true WebSocket support, consider using a custom server.
 */
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      const initialMessage = {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        source: 'system',
        message: 'Connected to log stream',
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialMessage)}\n\n`));

      // Function to send log entry
      const sendLog = (log: any) => {
        const logEntry = {
          timestamp: log.createdAt.toISOString(),
          level: log.level,
          source: extractSource(log.message),
          message: log.message,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(logEntry)}\n\n`));
      };

      // Fetch recent logs (last 100)
      try {
        const recentLogs = await prisma.log.findMany({
          take: 100,
          orderBy: { createdAt: 'desc' },
        });

        // Send recent logs in reverse order (oldest first)
        recentLogs.reverse().forEach(sendLog);
      } catch (error) {
        console.error('[Logs Stream] Failed to fetch recent logs:', error);
      }

      // Poll for new logs every 2 seconds
      const intervalId = setInterval(async () => {
        try {
          // Get logs from the last 3 seconds
          const since = new Date(Date.now() - 3000);
          const newLogs = await prisma.log.findMany({
            where: {
              createdAt: {
                gte: since,
              },
            },
            orderBy: { createdAt: 'asc' },
          });

          newLogs.forEach(sendLog);
        } catch (error) {
          console.error('[Logs Stream] Failed to fetch new logs:', error);
        }
      }, 2000);

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        controller.close();
      });
    },
  });

  // Return SSE response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * Extract source from log message
 */
function extractSource(message: string): string {
  if (message.includes('[FTP]')) return 'FTP';
  if (message.includes('[Email]') || message.includes('[SMTP]')) return 'Email';
  if (message.includes('[Worker]')) return 'Worker';
  if (message.includes('[ServiceManager]')) return 'System';
  if (message.includes('[Init]')) return 'System';
  if (message.includes('[OAuth]')) return 'System';
  return 'System';
}
