import { NextResponse } from 'next/server';
import { getMonthlyUsage } from '@/lib/cost-tracking';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const usage = await getMonthlyUsage();

    return NextResponse.json(usage);
  } catch (error: any) {
    console.error('Failed to fetch usage data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    );
  }
}
