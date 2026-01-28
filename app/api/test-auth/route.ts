import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export const runtime = 'nodejs';

/**
 * Test endpoint to check authentication
 */
export async function GET(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  console.log('[Test Auth] Token:', token ? 'Present' : 'Missing');
  console.log('[Test Auth] Token details:', JSON.stringify(token, null, 2));

  return NextResponse.json({
    authenticated: !!token,
    token: token ? {
      name: token.name,
      email: token.email,
      hasToken: !!(token as any).paperlessToken
    } : null,
    headers: {
      cookie: request.headers.get('cookie') ? 'Present' : 'Missing',
      authorization: request.headers.get('authorization') ? 'Present' : 'Missing',
    }
  });
}
