#!/usr/bin/env node

/**
 * Clear all process locks from database
 * Run this on container start to clean up stale locks
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearLocks() {
  console.log('[Lock Cleanup] Clearing all process locks...');

  const lockKeys = [
    'LOCK_AI_DOCUMENT_PROCESSING',
    'LOCK_DOCUMENT_UPLOAD',
    'LOCK_WORKER_CONSUME',
    'LOCK_ACTION_TASK_POLLING'
  ];

  for (const key of lockKeys) {
    try {
      await prisma.config.upsert({
        where: { key },
        update: {
          value: JSON.stringify({
            type: key.replace('LOCK_', ''),
            status: 'idle',
            startedAt: null,
            lastActivity: null,
          })
        },
        create: {
          key,
          value: JSON.stringify({
            type: key.replace('LOCK_', ''),
            status: 'idle',
            startedAt: null,
            lastActivity: null,
          })
        }
      });
      console.log(`[Lock Cleanup] ✓ Cleared ${key}`);
    } catch (error) {
      console.error(`[Lock Cleanup] ✗ Failed to clear ${key}:`, error.message);
    }
  }

  await prisma.$disconnect();
  console.log('[Lock Cleanup] Lock cleanup complete');
}

clearLocks().catch((error) => {
  console.error('[Lock Cleanup] Fatal error:', error);
  process.exit(1);
});
