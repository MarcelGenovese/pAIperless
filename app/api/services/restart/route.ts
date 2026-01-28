/**
 * Service Restart API
 *
 * Allows restarting specific services or all services.
 * Requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import serviceManager, { ServiceName } from '@/lib/services/service-manager';

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
    const { service } = body;

    // Validate service name
    if (!service || !['ftp', 'worker', 'all'].includes(service)) {
      return NextResponse.json(
        { error: 'Invalid service name. Must be: ftp, worker, or all' },
        { status: 400 }
      );
    }

    console.log(`[API] Restart request for service: ${service}`);

    // Restart the service
    const result = await serviceManager.restart(service as ServiceName);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          services: result.services,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      services: result.services,
    });
  } catch (error: any) {
    console.error('[API] Error restarting service:', error);
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
