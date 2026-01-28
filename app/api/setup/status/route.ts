import { NextRequest, NextResponse } from 'next/server';
import { isSetupComplete } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const setupComplete = await isSetupComplete();

    return NextResponse.json({
      setupComplete,
    });
  } catch (error: any) {
    console.error('Setup status check error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check setup status' },
      { status: 500 }
    );
  }
}
