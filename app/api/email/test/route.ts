/**
 * Email Test API
 *
 * Sends a test email to verify configuration.
 * Requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import emailService from '@/lib/services/email-service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { recipient } = body;

    console.log('[API] Email test request');
    if (recipient) {
      console.log(`[API] Test recipient: ${recipient}`);
    }

    // Verify connection first
    const verifyResult = await emailService.verifyConnection();
    if (!verifyResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: verifyResult.message,
          step: 'verify',
        },
        { status: 400 }
      );
    }

    // Send test email
    const sendResult = await emailService.sendTestEmail(recipient);

    if (!sendResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: sendResult.message,
          step: 'send',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: sendResult.message,
    });
  } catch (error: any) {
    console.error('[API] Error testing email:', error);
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

// Allow GET for easier testing without auth
export async function GET(req: NextRequest) {
  try {
    console.log('[API] Email test GET request (no auth)');

    // Verify connection
    const verifyResult = await emailService.verifyConnection();
    if (!verifyResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: verifyResult.message,
          step: 'verify',
        },
        { status: 400 }
      );
    }

    // Send test email
    const sendResult = await emailService.sendTestEmail();

    if (!sendResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: sendResult.message,
          step: 'send',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: sendResult.message,
    });
  } catch (error: any) {
    console.error('[API] Error testing email:', error);
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
