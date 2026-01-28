/**
 * Email Status API
 *
 * Returns the current email configuration status.
 */

import { NextResponse } from 'next/server';
import emailService from '@/lib/services/email-service';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const status = await emailService.getStatus();
    return NextResponse.json(status);
  } catch (error: any) {
    console.error('[API] Error getting email status:', error);
    return NextResponse.json(
      {
        enabled: false,
        configured: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
