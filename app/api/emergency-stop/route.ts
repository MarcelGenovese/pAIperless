import { NextRequest, NextResponse } from 'next/server';
import { isEmergencyStopActive, activateEmergencyStop, deactivateEmergencyStop } from '@/lib/emergency-stop';

export const runtime = 'nodejs';

/**
 * Get emergency stop status
 */
export async function GET() {
  try {
    const isActive = await isEmergencyStopActive();

    return NextResponse.json({
      active: isActive,
      message: isActive
        ? 'Emergency stop is ACTIVE - all processing halted'
        : 'Emergency stop is inactive',
    });
  } catch (error: any) {
    console.error('[Emergency Stop] Error getting status:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Toggle emergency stop
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { activate } = body;

    if (activate) {
      await activateEmergencyStop();
    } else {
      await deactivateEmergencyStop();
    }

    const isActive = await isEmergencyStopActive();

    return NextResponse.json({
      success: true,
      active: isActive,
      message: isActive
        ? '🚨 Emergency stop activated - all processing halted'
        : '✅ Emergency stop deactivated - processing can resume',
    });
  } catch (error: any) {
    console.error('[Emergency Stop] Error toggling:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
