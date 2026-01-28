import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getConfig, CONFIG_KEYS } from '@/lib/config';

export const runtime = 'nodejs';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/setup') ||
    pathname === '/api/version' ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/logo') ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next();
  }

  // Check if setup is complete
  const setupComplete = await getConfig(CONFIG_KEYS.SETUP_COMPLETED);

  // If setup is not complete, redirect to /setup (unless already there)
  if (setupComplete !== 'true') {
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

  // Skip auth check for routes that use FormData (to avoid body consumption)
  // These routes will handle auth internally
  const skipAuthRoutes = [
    '/auth/login',
    '/login',
    '/about',
    '/api/documents/upload', // Skip in middleware, check in route
  ];

  if (!skipAuthRoutes.some(route => pathname.startsWith(route))) {
    const cookies = request.cookies.getAll();
    console.log(`[Middleware] Path: ${pathname}`);
    console.log(`[Middleware] Cookies:`, cookies.map(c => c.name).join(', '));

    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    console.log(`[Middleware] Token: ${token ? 'Present' : 'Missing'}`);
    if (token) {
      console.log(`[Middleware] Token user:`, token.name);
    }

    if (!token) {
      // For API routes, return 401 instead of redirecting
      if (pathname.startsWith('/api/')) {
        console.log(`[Middleware] Returning 401 for ${pathname} - No valid session`);
        return NextResponse.json(
          { error: 'Unauthorized - Please login again', detail: 'No valid session found' },
          { status: 401 }
        );
      }
      console.log(`[Middleware] Redirecting to login`);
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
  } else if (pathname === '/api/documents/upload') {
    console.log(`[Middleware] Skipping auth for upload (checked in route)`);
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
