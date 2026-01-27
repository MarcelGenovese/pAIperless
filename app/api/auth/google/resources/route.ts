import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getConfigSecure, CONFIG_KEYS } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
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

    // Get calendars
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarsResponse = await calendar.calendarList.list();
    const calendars = calendarsResponse.data.items?.map((cal: any) => ({
      id: cal.id,
      name: cal.summary || cal.id,
      primary: cal.primary || false,
    })) || [];

    // Get task lists
    const tasks = google.tasks({ version: 'v1', auth: oauth2Client });
    const taskListsResponse = await tasks.tasklists.list();
    const taskLists = taskListsResponse.data.items?.map((list: any) => ({
      id: list.id,
      name: list.title || list.id,
    })) || [];

    return NextResponse.json({
      calendars,
      taskLists,
    });
  } catch (error: any) {
    console.error('Error fetching Google resources:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch resources' },
      { status: 500 }
    );
  }
}
