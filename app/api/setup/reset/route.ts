import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { setConfig, CONFIG_KEYS } from '@/lib/config';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized. Please login first.' },
        { status: 401 }
      );
    }

    // Set SETUP_COMPLETED to false to trigger setup wizard
    await setConfig(CONFIG_KEYS.SETUP_COMPLETED, 'false');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Setup reset error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reset setup' },
      { status: 500 }
    );
  }
}
