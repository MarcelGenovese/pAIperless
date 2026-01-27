import { NextResponse } from 'next/server';
import { isSetupComplete } from '@/lib/config';

export async function GET() {
  try {
    const setupComplete = await isSetupComplete();
    return NextResponse.json({ setupComplete });
  } catch (error) {
    console.error('Error checking setup status:', error);
    return NextResponse.json(
      { error: 'Failed to check setup status' },
      { status: 500 }
    );
  }
}
