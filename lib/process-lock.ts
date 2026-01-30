/**
 * Process Lock System
 * Prevents race conditions by ensuring only one instance of each process runs at a time
 */

import { prisma } from './prisma';
import { createLogger } from './logger';

const logger = createLogger('ProcessLock');

export type ProcessType =
  | 'AI_DOCUMENT_PROCESSING'  // Manual AI processing or webhook processing
  | 'DOCUMENT_UPLOAD'         // File upload to Paperless
  | 'WORKER_CONSUME'          // Worker processing consume folder
  | 'ACTION_TASK_POLLING';    // Polling for completed Google Tasks

export interface ProcessLock {
  type: ProcessType;
  status: 'running' | 'idle';
  startedAt: Date | null;
  lastActivity: Date | null;
  details?: string;
  progress?: {
    current?: number;
    total?: number;
    currentItem?: string;
    message?: string;
  };
}

// Lock timeout in milliseconds (5 minutes)
const LOCK_TIMEOUT = 5 * 60 * 1000;

/**
 * Try to acquire a lock for a process
 * Returns true if lock was acquired, false if already locked
 */
export async function acquireLock(type: ProcessType, details?: string): Promise<boolean> {
  try {
    // Check if lock already exists
    const existing = await prisma.config.findUnique({
      where: { key: `LOCK_${type}` },
    });

    if (existing) {
      const lockData: ProcessLock = JSON.parse(existing.value);

      // Check if lock is still valid (not timed out)
      if (lockData.status === 'running' && lockData.lastActivity) {
        const timeSinceActivity = Date.now() - new Date(lockData.lastActivity).getTime();

        if (timeSinceActivity < LOCK_TIMEOUT) {
          await logger.warn(`[${type}] Lock already held, cannot acquire`, { lockData });
          return false;
        }

        // Lock has timed out, we can take it
        await logger.warn(`[${type}] Lock timed out, forcefully acquiring`, { lockData });
      }
    }

    // Acquire the lock
    const lockData: ProcessLock = {
      type,
      status: 'running',
      startedAt: new Date(),
      lastActivity: new Date(),
      details,
    };

    await prisma.config.upsert({
      where: { key: `LOCK_${type}` },
      create: {
        key: `LOCK_${type}`,
        value: JSON.stringify(lockData),
      },
      update: {
        value: JSON.stringify(lockData),
      },
    });

    await logger.info(`[${type}] Lock acquired`, { details });
    return true;
  } catch (error) {
    await logger.error(`[${type}] Failed to acquire lock`, error);
    return false;
  }
}

/**
 * Release a lock for a process
 */
export async function releaseLock(type: ProcessType): Promise<void> {
  try {
    const lockData: ProcessLock = {
      type,
      status: 'idle',
      startedAt: null,
      lastActivity: null,
    };

    await prisma.config.upsert({
      where: { key: `LOCK_${type}` },
      create: {
        key: `LOCK_${type}`,
        value: JSON.stringify(lockData),
      },
      update: {
        value: JSON.stringify(lockData),
      },
    });

    await logger.info(`[${type}] Lock released`);
  } catch (error) {
    await logger.error(`[${type}] Failed to release lock`, error);
  }
}

/**
 * Update lock activity timestamp (keep-alive)
 */
export async function updateLockActivity(type: ProcessType): Promise<void> {
  try {
    const existing = await prisma.config.findUnique({
      where: { key: `LOCK_${type}` },
    });

    if (!existing) return;

    const lockData: ProcessLock = JSON.parse(existing.value);
    lockData.lastActivity = new Date();

    await prisma.config.update({
      where: { key: `LOCK_${type}` },
      data: { value: JSON.stringify(lockData) },
    });
  } catch (error) {
    await logger.error(`[${type}] Failed to update lock activity`, error);
  }
}

/**
 * Update lock progress information
 */
export async function updateLockProgress(
  type: ProcessType,
  progress: {
    current?: number;
    total?: number;
    currentItem?: string;
    message?: string;
  }
): Promise<void> {
  try {
    const existing = await prisma.config.findUnique({
      where: { key: `LOCK_${type}` },
    });

    if (!existing) return;

    const lockData: ProcessLock = JSON.parse(existing.value);
    lockData.lastActivity = new Date();
    lockData.progress = progress;

    await prisma.config.update({
      where: { key: `LOCK_${type}` },
      data: { value: JSON.stringify(lockData) },
    });
  } catch (error) {
    await logger.error(`[${type}] Failed to update lock progress`, error);
  }
}

/**
 * Check if a process is currently locked
 */
export async function isLocked(type: ProcessType): Promise<boolean> {
  try {
    const existing = await prisma.config.findUnique({
      where: { key: `LOCK_${type}` },
    });

    if (!existing) return false;

    const lockData: ProcessLock = JSON.parse(existing.value);

    if (lockData.status !== 'running') return false;

    // Check if lock has timed out
    if (lockData.lastActivity) {
      const timeSinceActivity = Date.now() - new Date(lockData.lastActivity).getTime();
      if (timeSinceActivity >= LOCK_TIMEOUT) {
        await logger.warn(`[${type}] Lock timed out, considering as unlocked`);
        return false;
      }
    }

    return true;
  } catch (error) {
    await logger.error(`[${type}] Failed to check lock status`, error);
    return false;
  }
}

/**
 * Get status of a specific lock
 */
export async function getLockStatus(type: ProcessType): Promise<ProcessLock | null> {
  try {
    const existing = await prisma.config.findUnique({
      where: { key: `LOCK_${type}` },
    });

    if (!existing) {
      return {
        type,
        status: 'idle',
        startedAt: null,
        lastActivity: null,
      };
    }

    const lockData: ProcessLock = JSON.parse(existing.value);

    // Check if lock has timed out
    if (lockData.status === 'running' && lockData.lastActivity) {
      const timeSinceActivity = Date.now() - new Date(lockData.lastActivity).getTime();
      if (timeSinceActivity >= LOCK_TIMEOUT) {
        lockData.status = 'idle';
        lockData.startedAt = null;
        lockData.lastActivity = null;
      }
    }

    return lockData;
  } catch (error) {
    await logger.error(`[${type}] Failed to get lock status`, error);
    return null;
  }
}

/**
 * Get status of all locks
 */
export async function getAllLockStatus(): Promise<Record<ProcessType, ProcessLock>> {
  const types: ProcessType[] = ['AI_DOCUMENT_PROCESSING', 'DOCUMENT_UPLOAD', 'WORKER_CONSUME'];

  const statuses: Partial<Record<ProcessType, ProcessLock>> = {};

  for (const type of types) {
    const status = await getLockStatus(type);
    if (status) {
      statuses[type] = status;
    }
  }

  return statuses as Record<ProcessType, ProcessLock>;
}

/**
 * Execute a function with a lock
 * Automatically acquires and releases the lock
 */
export async function withLock<T>(
  type: ProcessType,
  details: string,
  fn: () => Promise<T>
): Promise<T> {
  const acquired = await acquireLock(type, details);

  if (!acquired) {
    throw new Error(`Failed to acquire lock for ${type} - process already running`);
  }

  let activityInterval: NodeJS.Timeout | null = null;

  try {
    // Set up periodic activity updates
    activityInterval = setInterval(async () => {
      await updateLockActivity(type);
    }, 30000); // Update every 30 seconds

    const result = await fn();

    if (activityInterval) clearInterval(activityInterval);
    await releaseLock(type);

    return result;
  } catch (error) {
    // CRITICAL: Clean up interval even on error
    if (activityInterval) clearInterval(activityInterval);
    await releaseLock(type);
    throw error;
  }
}
