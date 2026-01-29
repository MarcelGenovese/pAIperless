/**
 * Central logging utility for pAIperless
 * Writes logs to both console and database for viewing in the dashboard
 */

import { prisma } from '@/lib/prisma';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface LogOptions {
  meta?: any;
  source?: string;
  consoleOnly?: boolean; // If true, only log to console, not database
}

/**
 * Write a log entry to both console and database
 */
export async function log(
  level: LogLevel,
  message: string,
  options: LogOptions = {}
): Promise<void> {
  const { meta, source, consoleOnly = false } = options;

  // Format message with source prefix if provided
  const formattedMessage = source ? `[${source}] ${message}` : message;

  // Always log to console
  const consoleMethod = level === 'ERROR' ? console.error :
                        level === 'WARN' ? console.warn :
                        console.log;
  consoleMethod(`[${level}] ${formattedMessage}`, meta || '');

  // Write to database unless consoleOnly is true
  if (!consoleOnly) {
    try {
      await prisma.log.create({
        data: {
          level,
          message: formattedMessage,
          meta: meta ? JSON.stringify(meta) : null,
        },
      });
    } catch (error) {
      // Fallback: if database write fails, at least log to console
      console.error('[Logger] Failed to write to database:', error);
    }
  }
}

/**
 * Convenience methods for different log levels
 */
export const logger = {
  info: (message: string, options?: LogOptions) => log('INFO', message, options),
  warn: (message: string, options?: LogOptions) => log('WARN', message, options),
  error: (message: string, options?: LogOptions) => log('ERROR', message, options),
  debug: (message: string, options?: LogOptions) => log('DEBUG', message, options),
};

/**
 * Create a logger instance with a specific source prefix
 */
export function createLogger(source: string) {
  return {
    info: (message: string, meta?: any) => log('INFO', message, { source, meta }),
    warn: (message: string, meta?: any) => log('WARN', message, { source, meta }),
    error: (message: string, meta?: any) => log('ERROR', message, { source, meta }),
    debug: (message: string, meta?: any) => log('DEBUG', message, { source, meta }),
  };
}
