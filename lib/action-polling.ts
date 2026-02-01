import { getConfig, CONFIG_KEYS } from './config';
import { getPaperlessClient } from './paperless';
import { getCompletedTasks, deleteTask, deleteCalendarEvent } from './google-calendar-tasks';
import { prisma } from './prisma';
import { createLogger } from './logger';
import { withLock, isLocked } from './process-lock';
import { checkEmergencyStop } from './emergency-stop';

const logger = createLogger('ActionPolling');

let pollInterval: NodeJS.Timeout | null = null;

/**
 * Process completed tasks and remove action_required tag from documents
 */
export async function processCompletedTasks(): Promise<{
  total: number;
  processed: number;
  results: Array<any>;
}> {
  // Check emergency stop first
  try {
    await checkEmergencyStop('Action polling');
  } catch (error) {
    await logger.warn('[Action Polling] Blocked by emergency stop');
    return { total: 0, processed: 0, results: [] };
  }

  // Check if already processing
  if (await isLocked('ACTION_TASK_POLLING')) {
    await logger.warn('[Action Polling] Action polling already running, skipping');
    return { total: 0, processed: 0, results: [] };
  }

  // Use lock to prevent concurrent processing
  return withLock('ACTION_TASK_POLLING', 'Checking completed tasks', async () => {
    try {
      await logger.info('[Action Polling] Starting completed task check');

      // Get completed tasks from Google
      const completedTasks = await getCompletedTasks();
      await logger.info(`[Action Polling] Found ${completedTasks.length} completed tasks`);

      if (completedTasks.length === 0) {
        return { total: 0, processed: 0, results: [] };
      }

      // Get Paperless client
      const paperlessClient = await getPaperlessClient();

      // Get the ACTION_REQUIRED tag ID
      const tagActionRequiredName = await getConfig(CONFIG_KEYS.TAG_ACTION_REQUIRED) || 'action_required';
      const tagActionRequiredId = await paperlessClient.getTagId(tagActionRequiredName);

      if (!tagActionRequiredId) {
        await logger.warn(`[Action Polling] ACTION_REQUIRED tag "${tagActionRequiredName}" not found in Paperless`);
        return { total: 0, processed: 0, results: [] };
      }

      // Process each completed task
      const results = [];
      let processed = 0;

      for (const task of completedTasks) {
        try {
          if (!task.paperlessDocId) {
            await logger.warn(`[Action Polling] Task ${task.id} has no Paperless document ID, skipping`);
            results.push({
              taskId: task.id,
              status: 'skipped',
              reason: 'No Paperless document ID',
            });
            continue;
          }

          await logger.info(`[Action Polling] Processing completed task for document ${task.paperlessDocId}`);

          // Get document from Paperless
          const doc = await paperlessClient.getDocument(task.paperlessDocId);

          if (!doc) {
            await logger.warn(`[Action Polling] Document ${task.paperlessDocId} not found in Paperless`);
            results.push({
              taskId: task.id,
              paperlessDocId: task.paperlessDocId,
              status: 'error',
              reason: 'Document not found in Paperless',
            });
            continue;
          }

          // Check if document has ACTION_REQUIRED tag
          const hasActionTag = doc.tags?.includes(tagActionRequiredId);

          if (!hasActionTag) {
            await logger.info(`[Action Polling] Document ${task.paperlessDocId} does not have ACTION_REQUIRED tag, skipping`);
            // Still delete the task from Google
            await deleteTask(task.id);
            results.push({
              taskId: task.id,
              paperlessDocId: task.paperlessDocId,
              status: 'skipped',
              reason: 'Document does not have ACTION_REQUIRED tag',
            });
            continue;
          }

          // Remove ACTION_REQUIRED tag from document
          const updatedTags = doc.tags?.filter((id: number) => id !== tagActionRequiredId) || [];

          await paperlessClient.updateDocument(task.paperlessDocId, {
            tags: updatedTags,
          });

          await logger.info(`[Action Polling] Removed ACTION_REQUIRED tag from document ${task.paperlessDocId}`);

          // Delete task from Google Tasks
          await deleteTask(task.id);

          // Delete calendar event if it exists
          const dbDoc = await prisma.document.findUnique({
            where: { paperlessId: task.paperlessDocId },
            select: { googleEventId: true },
          });

          if (dbDoc?.googleEventId) {
            await deleteCalendarEvent(dbDoc.googleEventId);
          }

          // Update database record
          await prisma.document.updateMany({
            where: { paperlessId: task.paperlessDocId },
            data: {
              googleTaskId: null,
              googleEventId: null,
            },
          });

          processed++;
          results.push({
            taskId: task.id,
            paperlessDocId: task.paperlessDocId,
            status: 'success',
          });

          await logger.info(`[Action Polling] Successfully processed completed task for document ${task.paperlessDocId}`);
        } catch (error: any) {
          await logger.error(`[Action Polling] Error processing task ${task.id}:`, error);
          results.push({
            taskId: task.id,
            paperlessDocId: task.paperlessDocId,
            status: 'error',
            error: error.message,
          });
        }
      }

      await logger.info(`[Action Polling] Completed task check. Processed: ${processed}/${completedTasks.length}`);

      return {
        total: completedTasks.length,
        processed,
        results,
      };
    } catch (error: any) {
      await logger.error('[Action Polling] Unexpected error:', error);
      return { total: 0, processed: 0, results: [] };
    }
  });
}

/**
 * Start polling for completed tasks
 */
export async function startActionPolling() {
  // Check if polling is enabled
  const pollEnabled = await getConfig(CONFIG_KEYS.POLL_ACTION_ENABLED) === 'true';

  if (!pollEnabled) {
    await logger.info('[Action Polling] Action polling is disabled');
    return;
  }

  // Get polling interval (in minutes)
  // Use POLL_TASK_COMPLETION_INTERVAL if available, otherwise fall back to POLL_ACTION_INTERVAL
  const taskCompletionInterval = await getConfig(CONFIG_KEYS.POLL_TASK_COMPLETION_INTERVAL);
  const actionInterval = await getConfig(CONFIG_KEYS.POLL_ACTION_INTERVAL);
  const intervalMinutes = parseInt(taskCompletionInterval || actionInterval || '30');
  const intervalMs = intervalMinutes * 60 * 1000;

  await logger.info(`[Action Polling] Starting task completion polling (interval: ${intervalMinutes} minutes)`);

  // Run immediately on startup (will check emergency stop internally)
  await processCompletedTasks();

  // Schedule recurring polling (each iteration will check emergency stop)
  pollInterval = setInterval(async () => {
    await processCompletedTasks();
  }, intervalMs);
}

/**
 * Stop polling
 */
export async function stopActionPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    await logger.info('[Action Polling] Action polling stopped');
  }
}

/**
 * Check if polling is currently running
 */
export function isActionPollingActive(): boolean {
  return pollInterval !== null;
}

/**
 * Restart polling with new settings
 */
export async function restartActionPolling() {
  await logger.info('[Action Polling] Restarting action polling with new settings...');
  await stopActionPolling();
  await startActionPolling();
}
