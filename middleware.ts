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
      return NextResponse.redirect(new URL('/setup', request.url));
    }
    return NextResponse.next();
  }

  // If setup is complete and user is on /setup, redirect to /auth/login
  if (pathname.startsWith('/setup')) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // Check authentication for protected routes
  if (!pathname.startsWith('/auth/login') && !pathname.startsWith('/login')) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
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
