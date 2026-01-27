import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getConfigSecure, setConfigSecure, getConfig, CONFIG_KEYS } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL(`/setup?oauth_error=${encodeURIComponent('Authorization denied')}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL(`/setup?oauth_error=${encodeURIComponent('No authorization code received')}`, request.url)
      );
    }

    // Get OAuth credentials from config
    const clientId = await getConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_CLIENT_ID);
    const clientSecret = await getConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_CLIENT_SECRET);
    const baseUrl = await getConfig(CONFIG_KEYS.BASE_URL);

    if (!clientId || !clientSecret || !baseUrl) {
      return NextResponse.redirect(
        new URL(`/setup?oauth_error=${encodeURIComponent('OAuth configuration not found')}`, request.url)
      );
    }

    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return NextResponse.redirect(
        new URL(`/setup?oauth_error=${encodeURIComponent('Failed to get access token')}`, request.url)
      );
    }

    // Save tokens
    await setConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_ACCESS_TOKEN, tokens.access_token);

    if (tokens.refresh_token) {
      await setConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_REFRESH_TOKEN, tokens.refresh_token);
    }

    // Redirect back to setup with success
    return NextResponse.redirect(
      new URL('/setup?oauth_success=true', request.url)
    );
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(`/setup?oauth_error=${encodeURIComponent(error.message || 'OAuth failed')}`, request.url)
    );
  }
}
