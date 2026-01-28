import { NextRequest, NextResponse } from 'next/server';
import { getConfigSecure, getConfig, CONFIG_KEYS } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const clientId = await getConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_CLIENT_ID);
    const clientSecret = await getConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_CLIENT_SECRET);
    const calendarId = await getConfig(CONFIG_KEYS.GOOGLE_CALENDAR_ID);
    const taskListId = await getConfig(CONFIG_KEYS.GOOGLE_TASK_LIST_ID);

    return NextResponse.json({
      clientId: clientId || '',
      clientSecret: clientSecret || '',
      calendarId: calendarId || '',
      taskListId: taskListId || '',
    });
  } catch (error: any) {
    console.error('Error fetching OAuth config:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch OAuth config' },
      { status: 500 }
    );
  }
}
