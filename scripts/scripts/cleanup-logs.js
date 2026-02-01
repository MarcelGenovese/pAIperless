#!/usr/bin/env node
/**
 * Log Cleanup Script
 * Run via cron to clean old logs from database and filesystem
 * Usage: node scripts/cleanup-logs.js
 */

const { PrismaClient } = require('@prisma/client');
const { readdir, stat, unlink } = require('fs/promises');
const { join } = require('path');

const prisma = new PrismaClient();
const LOG_RETENTION_DAYS = 28;

async function cleanDatabaseLogs() {
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

    console.log(`[Log Cleanup] Deleted ${result.count} database entries older than ${LOG_RETENTION_DAYS} days`);
    return result.count;
  } catch (error) {
    console.error('[Log Cleanup] Failed to clean database logs:', error);
    return 0;
  }
}

async function cleanFilesystemLogs() {
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
          console.error(`[Log Cleanup] Failed to process file ${file}:`, error.message);
        }
      }

      if (deletedCount > 0) {
        console.log(`[Log Cleanup] Deleted ${deletedCount} filesystem files older than ${LOG_RETENTION_DAYS} days`);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    return deletedCount;
  } catch (error) {
    console.error('[Log Cleanup] Failed to clean filesystem logs:', error);
    return 0;
  }
}

async function main() {
  console.log('[Log Cleanup] Starting cleanup...');

  const dbCount = await cleanDatabaseLogs();
  const fsCount = await cleanFilesystemLogs();

  console.log(`[Log Cleanup] Completed: ${dbCount} DB entries, ${fsCount} files deleted`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error('[Log Cleanup] Fatal error:', error);
  prisma.$disconnect();
  process.exit(1);
});
