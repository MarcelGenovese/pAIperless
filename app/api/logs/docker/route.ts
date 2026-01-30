import { useTranslations } from 'next-intl';
import { NextRequest } from 'next/server';
import { spawn } from 'child_process';

export const runtime = 'nodejs';

/**
 * Stream Docker container logs via Server-Sent Events (SSE)
 *
 * This endpoint streams live docker logs from the container.
 * It captures ALL output: console.log, framework errors, system errors, etc.
 */
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  // Get query parameters
  const url = new URL(request.url);
  const tail = url.searchParams.get('tail') || '500'; // Number of lines to show initially
  const follow = url.searchParams.get('follow') !== 'false'; // Whether to follow new logs

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const initialMessage = {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: 'Connected to docker log stream',
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialMessage)}\n\n`));

      // Spawn docker logs command
      const args = ['logs', '--tail', tail, '--timestamps'];
      if (follow) {
        args.push('-f');
      }
      args.push('paiperless');

      const dockerLogs = spawn('docker', args);

      // Handle stdout (regular logs)
      dockerLogs.stdout.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        lines.forEach(line => {
          const logEntry = parseDockerLogLine(line);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(logEntry)}\n\n`));
        });
      });

      // Handle stderr (error logs)
      dockerLogs.stderr.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        lines.forEach(line => {
          const logEntry = parseDockerLogLine(line, true);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(logEntry)}\n\n`));
        });
      });

      // Handle errors
      dockerLogs.on('error', (error: Error) => {
        const errorEntry = {
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          source: 'docker',
          message: `Failed to read docker logs: ${error.message}`,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEntry)}\n\n`));
        controller.close();
      });

      // Handle process exit
      dockerLogs.on('close', (code: number) => {
        if (code !== 0) {
          const closeEntry = {
            timestamp: new Date().toISOString(),
            level: 'WARN',
            source: 'docker',
            message: `Docker logs process exited with code ${code}`,
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(closeEntry)}\n\n`));
        }
        controller.close();
      });

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        dockerLogs.kill();
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
 * Parse a docker log line and extract structured information
 * Docker log format: TIMESTAMP MESSAGE
 */
function parseDockerLogLine(line: string, isError: boolean = false): any {
  // Docker adds timestamps in RFC3339Nano format
  const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(.*)$/);

  if (timestampMatch) {
    const timestamp = timestampMatch[1];
    const message = timestampMatch[2];

    return {
      timestamp,
      level: detectLogLevel(message, isError),
      source: extractSource(message),
      message: message.trim(),
    };
  }

  // Fallback if no timestamp
  return {
    timestamp: new Date().toISOString(),
    level: isError ? 'ERROR' : 'INFO',
    source: 'docker',
    message: line.trim(),
  };
}

/**
 * Detect log level from message content
 */
function detectLogLevel(message: string, isError: boolean = false): string {
  const upperMessage = message.toUpperCase();

  if (isError || upperMessage.includes('[ERROR]') || upperMessage.includes('ERROR:')) {
    return 'ERROR';
  }
  if (upperMessage.includes('[WARN]') || upperMessage.includes('WARNING:')) {
    return 'WARN';
  }
  if (upperMessage.includes('[DEBUG]') || upperMessage.includes('DEBUG:')) {
    return 'DEBUG';
  }

  return 'INFO';
}

/**
 * Extract source from log message
 */
function extractSource(message: string): string {
  // Look for tagged sources
  if (message.includes('[Upload]')) return 'Upload';
  if (message.includes('[FTP]')) return t('ftp');
  if (message.includes('[Email]') || message.includes('[SMTP]')) return 'Email';
  if (message.includes('[Worker]')) return 'Worker';
  if (message.includes('[Middleware]')) return 'Middleware';
  if (message.includes('[ServiceManager]')) return 'System';
  if (message.includes('[Init]')) return 'System';
  if (message.includes('[OAuth]')) return 'OAuth';
  if (message.includes('[Paperless]')) return t('paperless');

  // Check for framework errors
  if (message.includes('TypeError') || message.includes('ReferenceError') || message.includes('SyntaxError')) {
    return t('systemInfo.framework');
  }

  // Check for Next.js specific logs
  if (message.includes('compiled') || message.includes('webpack')) {
    return 'Next.js';
  }

  return 'System';
}
