import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getConfig, CONFIG_KEYS } from '@/lib/config';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, clientSecret, state } = body;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Missing client ID or secret' },
        { status: 400 }
      );
    }

    // Get base URL from request headers (handles proxies correctly)
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${protocol}://${host}`;
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    console.log('OAuth redirect URI:', redirectUri);

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/tasks',
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force consent to get refresh token
      state: state || '4', // Pass step number to preserve navigation
    });

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('Error generating OAuth URL:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate OAuth URL' },
      { status: 500 }
    );
  }
}
