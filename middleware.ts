import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getConfig, CONFIG_KEYS } from '@/lib/config';
import { createLogger } from '@/lib/logger';

export const runtime = 'nodejs';

// Create a middleware-specific logger
const logger = createLogger('Middleware');

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/setup') ||
    pathname.startsWith('/api/webhooks/') ||  // Webhooks have their own API key auth
    pathname.startsWith('/api/services/init') ||  // Service initialization on startup
    pathname === '/api/version' ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/logo') ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next();
  }

  // CRITICAL: Skip FormData routes IMMEDIATELY - BEFORE any async calls!
  // Even database calls can disturb the request body
  const skipAuthRoutes = [
    '/auth/login',
    '/login',
    '/about',
    '/api/documents/upload', // Skip completely - auth checked in route handler
    '/api/pipeline-test/start', // Skip to avoid body consumption issues with FormData
  ];

  if (skipAuthRoutes.some(route => pathname.startsWith(route))) {
    // Return immediately without ANY processing whatsoever
    return NextResponse.next();
  }

  // Check if setup is complete (safe to do async calls now)
  const setupComplete = await getConfig(CONFIG_KEYS.SETUP_COMPLETED);

  // If setup is not complete, redirect to /setup (unless already there)
  if (setupComplete !== 'true') {
    // Allow /api/email/ during setup ONLY
    if (pathname.startsWith('/api/email/')) {
      return NextResponse.next();
    }

    if (!pathname.startsWith('/setup')) {
      // For API routes, return JSON error
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Setup not complete' },
          { status: 503 }
        );
      }
      return NextResponse.redirect(new URL('/setup', request.url));
    }
    return NextResponse.next();
  }

  // If setup is complete and user is on /setup, redirect to /auth/login
  if (pathname.startsWith('/setup')) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // All other routes: perform auth check
  const cookies = request.cookies.getAll();
  await logger.debug(`Path: ${pathname}`, { cookies: cookies.map(c => c.name) });

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  await logger.debug(`Token: ${token ? 'Present' : 'Missing'}`, token ? { user: token.name } : undefined);

  if (!token) {
    // For API routes, return 401 instead of redirecting
    if (pathname.startsWith('/api/')) {
      await logger.warn(`Returning 401 for ${pathname} - No valid session`);
      return NextResponse.json(
        { error: 'Unauthorized - Please login again', detail: 'No valid session found' },
        { status: 401 }
      );
    }
    await logger.info(`Redirecting to login from ${pathname}`);
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)',
  ],
};
