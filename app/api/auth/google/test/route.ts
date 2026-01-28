import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getConfigSecure, CONFIG_KEYS } from '@/lib/config';

export const runtime = 'nodejs';

/**
 * Test Google OAuth integration by creating test entries
 * Creates a calendar event and a task that persist as proof of successful connection
 */
export async function POST(request: NextRequest) {
  try {
    // Get OAuth credentials and tokens
    const clientId = await getConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_CLIENT_ID);
    const clientSecret = await getConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_CLIENT_SECRET);
    const accessToken = await getConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_ACCESS_TOKEN);
    const refreshToken = await getConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_REFRESH_TOKEN);

    if (!clientId || !clientSecret || !accessToken) {
      return NextResponse.json(
        { error: 'OAuth not configured or tokens missing' },
        { status: 401 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const results = {
      calendar: null as any,
      task: null as any,
    };

    // Get calendar ID and task list ID from request or use configured ones
    const body = await request.json();
    const calendarId = body.calendarId || (await import('@/lib/config').then(m => m.getConfig(CONFIG_KEYS.GOOGLE_CALENDAR_ID))) || 'primary';
    const taskListId = body.taskListId || (await import('@/lib/config').then(m => m.getConfig(CONFIG_KEYS.GOOGLE_TASK_LIST_ID)));

    // Test Calendar API - Create a test event
    try {
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const event = {
        summary: '🎉 pAIperless Connection Test',
        description: 'This event was created by pAIperless to test the Google Calendar integration. You can keep or delete this event.',
        start: {
          dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
          timeZone: 'UTC',
        },
        end: {
          dateTime: new Date(Date.now() + 90 * 60 * 1000).toISOString(), // 1.5 hours from now
          timeZone: 'UTC',
        },
        colorId: '10', // Green color for success
      };

      const response = await calendar.events.insert({
        calendarId: calendarId,
        requestBody: event,
      });

      results.calendar = {
        success: true,
        eventId: response.data.id,
        eventLink: response.data.htmlLink,
        summary: response.data.summary,
      };

      console.log('[OAuth Test] Created test calendar event:', response.data.id);
    } catch (error: any) {
      console.error('[OAuth Test] Calendar test failed:', error);
      results.calendar = {
        success: false,
        error: error.message,
      };
    }

    // Test Tasks API - Create a test task
    try {
      if (!taskListId) {
        throw new Error('No task list configured');
      }

      const tasks = google.tasks({ version: 'v1', auth: oauth2Client });

      const task = {
        title: '✅ pAIperless Connection Test',
        notes: 'This task was created by pAIperless to test the Google Tasks integration. You can complete or delete this task.',
        due: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      };

      const response = await tasks.tasks.insert({
        tasklist: taskListId,
        requestBody: task,
      });

      results.task = {
        success: true,
        taskId: response.data.id,
        title: response.data.title,
        taskListId: taskListId,
      };

      console.log('[OAuth Test] Created test task:', response.data.id);
    } catch (error: any) {
      console.error('[OAuth Test] Tasks test failed:', error);
      results.task = {
        success: false,
        error: error.message,
      };
    }

    // Determine overall success
    const overallSuccess = results.calendar.success && results.task.success;

    return NextResponse.json({
      success: overallSuccess,
      message: overallSuccess
        ? 'Test entries created successfully! Check your Google Calendar and Tasks.'
        : 'Some tests failed. See details below.',
      details: results,
    });
  } catch (error: any) {
    console.error('[OAuth Test] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to test OAuth integration' },
      { status: 500 }
    );
  }
}
