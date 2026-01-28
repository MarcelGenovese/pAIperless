import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getConfigSecure, setConfigSecure, getConfig, CONFIG_KEYS } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state'); // Get step number from state

    // Get base URL from request headers
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${protocol}://${host}`;

    // Build redirect URL with step parameter
    const stepParam = state ? `&step=${state}` : '';

    if (error) {
      return NextResponse.redirect(
        new URL(`/setup?oauth_error=${encodeURIComponent('Authorization denied')}${stepParam}`, baseUrl)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL(`/setup?oauth_error=${encodeURIComponent('No authorization code received')}${stepParam}`, baseUrl)
      );
    }

    // Get OAuth credentials from config
    const clientId = await getConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_CLIENT_ID);
    const clientSecret = await getConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_CLIENT_SECRET);

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL(`/setup?oauth_error=${encodeURIComponent('OAuth configuration not found')}${stepParam}`, baseUrl)
      );
    }

    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    console.log('OAuth callback - redirect URI:', redirectUri);

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return NextResponse.redirect(
        new URL(`/setup?oauth_error=${encodeURIComponent('Failed to get access token')}${stepParam}`, baseUrl)
      );
    }

    // Save tokens
    await setConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_ACCESS_TOKEN, tokens.access_token);

    if (tokens.refresh_token) {
      await setConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_REFRESH_TOKEN, tokens.refresh_token);
    }

    // Redirect back to setup with success and step
    return NextResponse.redirect(
      new URL(`/setup?oauth_success=true${stepParam}`, baseUrl)
    );
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    // Reconstruct baseUrl and state in catch block
    const searchParams = request.nextUrl.searchParams;
    const state = searchParams.get('state');
    const stepParam = state ? `&step=${state}` : '';
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const errorBaseUrl = `${protocol}://${host}`;
    return NextResponse.redirect(
      new URL(`/setup?oauth_error=${encodeURIComponent(error.message || 'OAuth failed')}${stepParam}`, errorBaseUrl)
    );
  }
}
