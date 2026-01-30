import { google } from 'googleapis';
import { getConfigSecure, getConfig, CONFIG_KEYS } from './config';
import { createLogger } from './logger';
import { prisma } from './prisma';

const logger = createLogger('GoogleCalendarTasks');

/**
 * Get authenticated Google OAuth2 client
 */
async function getOAuth2Client() {
  const clientId = await getConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_CLIENT_ID);
  const clientSecret = await getConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_CLIENT_SECRET);
  const accessToken = await getConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_ACCESS_TOKEN);
  const refreshToken = await getConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_REFRESH_TOKEN);

  if (!clientId || !clientSecret || !accessToken) {
    throw new Error('Google OAuth not configured');
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return oauth2Client;
}

/**
 * Create Google Calendar event for action-required document
 */
export async function createCalendarEvent(
  title: string,
  description: string,
  dueDate: string | null,
  paperlessDocumentId: number
): Promise<string | null> {
  try {
    const oauth2Client = await getOAuth2Client();
    const calendarId = await getConfig(CONFIG_KEYS.GOOGLE_CALENDAR_ID);

    if (!calendarId) {
      await logger.warn('Google Calendar ID not configured, skipping calendar event creation');
      return null;
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Determine event date/time
    let startDateTime: string;
    let endDateTime: string;

    if (dueDate) {
      // Use due date as event date
      startDateTime = `${dueDate}T09:00:00`;
      endDateTime = `${dueDate}T10:00:00`;
    } else {
      // No due date - create event for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];
      startDateTime = `${dateStr}T09:00:00`;
      endDateTime = `${dateStr}T10:00:00`;
    }

    const event = {
      summary: `📄 ${title}`,
      description: `${description}\n\nPaperless Document ID: ${paperlessDocumentId}`,
      start: {
        dateTime: startDateTime,
        timeZone: 'Europe/Berlin',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'Europe/Berlin',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 60 }, // 1 hour before
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    await logger.info(`Calendar event created: ${response.data.id} for document ${paperlessDocumentId}`);
    return response.data.id || null;
  } catch (error: any) {
    await logger.error('Failed to create calendar event', error);
    return null;
  }
}

/**
 * Create Google Task for action-required document
 */
export async function createTask(
  title: string,
  description: string,
  dueDate: string | null,
  paperlessDocumentId: number
): Promise<string | null> {
  try {
    const oauth2Client = await getOAuth2Client();
    const taskListId = await getConfig(CONFIG_KEYS.GOOGLE_TASK_LIST_ID);

    if (!taskListId) {
      await logger.warn('Google Task List ID not configured, skipping task creation');
      return null;
    }

    const tasks = google.tasks({ version: 'v1', auth: oauth2Client });

    const task: any = {
      title: `📄 ${title}`,
      notes: `${description}\n\nPaperless Document ID: ${paperlessDocumentId}`,
    };

    // Add due date if available
    if (dueDate) {
      task.due = `${dueDate}T00:00:00.000Z`;
    }

    const response = await tasks.tasks.insert({
      tasklist: taskListId,
      requestBody: task,
    });

    await logger.info(`Task created: ${response.data.id} for document ${paperlessDocumentId}`);
    return response.data.id || null;
  } catch (error: any) {
    await logger.error('Failed to create task', error);
    return null;
  }
}

/**
 * Check if calendar event or task already exists for a document
 */
export async function hasExistingCalendarOrTask(paperlessDocumentId: number): Promise<boolean> {
  try {
    const document = await prisma.document.findFirst({
      where: { paperlessId: paperlessDocumentId },
      select: { googleEventId: true, googleTaskId: true },
    });

    if (!document) {
      return false;
    }

    return !!(document.googleEventId || document.googleTaskId);
  } catch (error: any) {
    await logger.error('Failed to check existing calendar/task', error);
    return false;
  }
}

/**
 * Get all completed tasks from Google Tasks
 */
export async function getCompletedTasks(): Promise<Array<{ id: string; title: string; paperlessDocId: number | null }>> {
  try {
    const oauth2Client = await getOAuth2Client();
    const taskListId = await getConfig(CONFIG_KEYS.GOOGLE_TASK_LIST_ID);

    if (!taskListId) {
      return [];
    }

    const tasks = google.tasks({ version: 'v1', auth: oauth2Client });

    // Get completed tasks
    const response = await tasks.tasks.list({
      tasklist: taskListId,
      showCompleted: true,
      showHidden: true,
    });

    const completedTasks: Array<{ id: string; title: string; paperlessDocId: number | null }> = [];

    for (const task of response.data.items || []) {
      if (task.status === 'completed' && task.id) {
        // Extract Paperless Document ID from notes
        let paperlessDocId: number | null = null;
        if (task.notes) {
          const match = task.notes.match(/Paperless Document ID: (\d+)/);
          if (match) {
            paperlessDocId = parseInt(match[1]);
          }
        }

        completedTasks.push({
          id: task.id,
          title: task.title || 'Untitled',
          paperlessDocId,
        });
      }
    }

    return completedTasks;
  } catch (error: any) {
    await logger.error('Failed to get completed tasks', error);
    return [];
  }
}

/**
 * Delete a Google Task
 */
export async function deleteTask(taskId: string): Promise<boolean> {
  try {
    const oauth2Client = await getOAuth2Client();
    const taskListId = await getConfig(CONFIG_KEYS.GOOGLE_TASK_LIST_ID);

    if (!taskListId) {
      return false;
    }

    const tasks = google.tasks({ version: 'v1', auth: oauth2Client });

    await tasks.tasks.delete({
      tasklist: taskListId,
      task: taskId,
    });

    await logger.info(`Task deleted: ${taskId}`);
    return true;
  } catch (error: any) {
    await logger.error('Failed to delete task', error);
    return false;
  }
}

/**
 * Delete a Google Calendar event
 */
export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  try {
    const oauth2Client = await getOAuth2Client();
    const calendarId = await getConfig(CONFIG_KEYS.GOOGLE_CALENDAR_ID);

    if (!calendarId) {
      return false;
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
      calendarId,
      eventId,
    });

    await logger.info(`Calendar event deleted: ${eventId}`);
    return true;
  } catch (error: any) {
    await logger.error('Failed to delete calendar event', error);
    return false;
  }
}
