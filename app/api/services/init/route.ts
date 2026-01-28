/**
 * Service Initialization API
 *
 * Triggers service initialization. This endpoint can be called
 * on application startup to ensure all services are running.
 */

import { NextResponse } from 'next/server';
import { initializeServices } from '@/lib/services/init';

export const runtime = 'nodejs';

export async function POST() {
  try {
    console.log('[API] Service initialization requested');

    // Initialize services (will skip if already initialized)
    await initializeServices();

    return NextResponse.json({
      success: true,
      message: 'Services initialized',
    });
  } catch (error: any) {
    console.error('[API] Error initializing services:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Allow GET for easier testing
  return POST();
}
