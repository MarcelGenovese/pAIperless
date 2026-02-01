import { NextResponse } from 'next/server';
import { getConfig, CONFIG_KEYS } from '@/lib/config';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ProcessLock {
  type: string;
  status: 'running' | 'idle';
  startedAt: Date | null;
  lastActivity: Date | null;
  details?: string;
}

export async function GET() {
  try {
    // Get AI Todo polling settings
    const aiTodoEnabled = (await getConfig(CONFIG_KEYS.POLL_AI_TODO_ENABLED)) === 'true';
    const aiTodoInterval = parseInt(await getConfig(CONFIG_KEYS.POLL_AI_TODO_INTERVAL) || '30');

    // Get Action polling settings
    const actionEnabled = (await getConfig(CONFIG_KEYS.POLL_ACTION_ENABLED)) === 'true';
    // Use POLL_TASK_COMPLETION_INTERVAL if available, otherwise fall back to POLL_ACTION_INTERVAL
    const taskCompletionInterval = await getConfig(CONFIG_KEYS.POLL_TASK_COMPLETION_INTERVAL);
    const fallbackInterval = await getConfig(CONFIG_KEYS.POLL_ACTION_INTERVAL);
    const actionInterval = parseInt(taskCompletionInterval || fallbackInterval || '30');

    // Get Consume folder polling settings
    const consumeEnabled = (await getConfig(CONFIG_KEYS.POLL_CONSUME_ENABLED)) === 'true';
    const consumeInterval = parseInt(await getConfig(CONFIG_KEYS.POLL_CONSUME_INTERVAL) || '10');

    // Get last run times from Config-based locks
    let aiTodoLastActivity: Date | null = null;
    let actionLastActivity: Date | null = null;
    let consumeLastActivity: Date | null = null;

    try {
      // Read AI_DOCUMENT_PROCESSING lock
      const aiTodoLockConfig = await prisma.config.findUnique({
        where: { key: 'LOCK_AI_DOCUMENT_PROCESSING' }
      });
      if (aiTodoLockConfig) {
        const lockData: ProcessLock = JSON.parse(aiTodoLockConfig.value);
        aiTodoLastActivity = lockData.lastActivity ? new Date(lockData.lastActivity) : null;
      }

      // Read ACTION_TASK_POLLING lock
      const actionLockConfig = await prisma.config.findUnique({
        where: { key: 'LOCK_ACTION_TASK_POLLING' }
      });
      if (actionLockConfig) {
        const lockData: ProcessLock = JSON.parse(actionLockConfig.value);
        actionLastActivity = lockData.lastActivity ? new Date(lockData.lastActivity) : null;
      }

      // Read WORKER_CONSUME lock (for consume folder)
      const consumeLockConfig = await prisma.config.findUnique({
        where: { key: 'LOCK_WORKER_CONSUME' }
      });
      if (consumeLockConfig) {
        const lockData: ProcessLock = JSON.parse(consumeLockConfig.value);
        consumeLastActivity = lockData.lastActivity ? new Date(lockData.lastActivity) : null;
      }
    } catch (lockError) {
      console.log('[Polling Status] Failed to read locks:', lockError);
    }

    // Calculate next run times
    const now = new Date();

    let aiTodoLastRun: string | undefined;
    let aiTodoNextRun: string | undefined;

    if (aiTodoLastActivity) {
      aiTodoLastRun = aiTodoLastActivity.toISOString();

      // Calculate next run based on last activity + interval
      // This represents the ACTUAL next setInterval trigger
      let nextTime = aiTodoLastActivity.getTime() + aiTodoInterval * 60 * 1000;

      // If next run is in the past (overdue), calculate the NEXT future trigger
      // by adding intervals until we're in the future
      while (nextTime <= now.getTime()) {
        nextTime += aiTodoInterval * 60 * 1000;
      }

      aiTodoNextRun = new Date(nextTime).toISOString();
    } else if (aiTodoEnabled) {
      // If never run before, next run is very soon (within 1 minute)
      aiTodoNextRun = new Date(now.getTime() + 60 * 1000).toISOString();
    }

    let actionLastRun: string | undefined;
    let actionNextRun: string | undefined;

    if (actionLastActivity) {
      actionLastRun = actionLastActivity.toISOString();

      // Calculate next run based on last activity + interval
      // This represents the ACTUAL next setInterval trigger
      let nextTime = actionLastActivity.getTime() + actionInterval * 60 * 1000;

      // If next run is in the past (overdue), calculate the NEXT future trigger
      // by adding intervals until we're in the future
      while (nextTime <= now.getTime()) {
        nextTime += actionInterval * 60 * 1000;
      }

      actionNextRun = new Date(nextTime).toISOString();
    } else if (actionEnabled) {
      // If never run before, next run is very soon (within 1 minute)
      actionNextRun = new Date(now.getTime() + 60 * 1000).toISOString();
    }

    // Calculate consume next run
    let consumeLastRun: string | undefined;
    let consumeNextRun: string | undefined;

    if (consumeLastActivity) {
      consumeLastRun = consumeLastActivity.toISOString();

      // Calculate next run based on last activity + interval
      // This represents the ACTUAL next setInterval trigger
      let nextTime = consumeLastActivity.getTime() + consumeInterval * 60 * 1000;

      // If next run is in the past (overdue), calculate the NEXT future trigger
      // by adding intervals until we're in the future
      while (nextTime <= now.getTime()) {
        nextTime += consumeInterval * 60 * 1000;
      }

      consumeNextRun = new Date(nextTime).toISOString();
    } else if (consumeEnabled) {
      // If never run before, next run is very soon (within 1 minute)
      consumeNextRun = new Date(now.getTime() + 60 * 1000).toISOString();
    }

    return NextResponse.json({
      aiTodo: {
        enabled: aiTodoEnabled,
        interval: aiTodoInterval,
        lastRun: aiTodoLastRun,
        nextRun: aiTodoNextRun,
      },
      action: {
        enabled: actionEnabled,
        interval: actionInterval,
        lastRun: actionLastRun,
        nextRun: actionNextRun,
      },
      consume: {
        enabled: consumeEnabled,
        interval: consumeInterval,
        lastRun: consumeLastRun,
        nextRun: consumeNextRun,
      },
    });
  } catch (error: any) {
    console.error('Failed to get polling status:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
