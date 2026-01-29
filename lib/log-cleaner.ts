/**
 * Log Cleaner
 * Provides functions for manual log cleanup
 * Automatic cleanup is handled by cron job (scripts/cleanup-logs.js)
 */

import { prisma } from '@/lib/prisma';
import { readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';

// Keep logs for 4 weeks (28 days)
const LOG_RETENTION_DAYS = 28;

/**
 * Clean old logs from database
 */
export async function cleanDatabaseLogs(): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - LOG_RETENTION_DAYS);

    const result = await prisma.log.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  } catch (error) {
    console.error('[Log Cleanup] Failed to clean database logs:', error);
    return 0;
  }
}

/**
 * Clean old log files from filesystem
 */
export async function cleanFilesystemLogs(): Promise<number> {
  try {
    const logsDir = process.env.LOGS_DIR || '/app/storage/logs';
    let deletedCount = 0;

    try {
      const files = await readdir(logsDir);
      const cutoffTime = Date.now() - (LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);

      for (const file of files) {
        if (!file.endsWith('.log') && !file.endsWith('.txt')) {
          continue;
        }

        const filePath = join(logsDir, file);
        try {
          const stats = await stat(filePath);

          if (stats.mtime.getTime() < cutoffTime) {
            await unlink(filePath);
            deletedCount++;
          }
        } catch (error) {
          console.error(`[Log Cleanup] Failed to process file ${file}:`, error);
        }
      }
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }

    return deletedCount;
  } catch (error) {
    console.error('[Log Cleanup] Failed to clean filesystem logs:', error);
    return 0;
  }
}

/**
 * Clean all logs (database + filesystem)
 * Used by manual cleanup and API endpoint
 */
export async function cleanAllLogs(): Promise<{ database: number; filesystem: number }> {
  const dbCount = await cleanDatabaseLogs();
  const fsCount = await cleanFilesystemLogs();

  return {
    database: dbCount,
    filesystem: fsCount,
  };
}
