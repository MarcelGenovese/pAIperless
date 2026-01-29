import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const runtime = 'nodejs';

/**
 * Get docker logs as plain text
 */
export async function GET(request: NextRequest) {
  console.log('[DockerText] API endpoint called');

  try {
    const url = new URL(request.url);
    const lines = url.searchParams.get('lines') || '500';

    console.log(`[DockerText] Fetching ${lines} lines of logs`);

    const { stdout, stderr } = await execAsync(`docker logs paiperless --tail ${lines} --timestamps 2>&1`);
    const output = stdout + stderr;

    console.log(`[DockerText] Successfully fetched ${output.split('\n').length} lines`);

    return new Response(output, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error: any) {
    console.error('[DockerText] Error fetching logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch docker logs', detail: error.message },
      { status: 500 }
    );
  }
}
