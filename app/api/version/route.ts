import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

/**
 * Get application version from git or version.txt
 */
export async function GET() {
  try {
    // First try to read from version.txt (Docker/production)
    const versionFile = path.join(process.cwd(), 'public', 'version.txt');
    if (existsSync(versionFile)) {
      const version = readFileSync(versionFile, 'utf-8').trim();
      if (version && version.length > 0 && !version.startsWith('<!DOCTYPE')) {
        return NextResponse.json({ version });
      }
    }

    // Try to get from git (development)
    try {
      // Try git tag first
      const gitTag = execSync('git describe --tags --exact-match 2>/dev/null', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();

      if (gitTag) {
        return NextResponse.json({ version: gitTag });
      }
    } catch (e) {
      // No exact tag, try git commit
      try {
        const gitCommit = execSync('git rev-parse --short HEAD', {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        }).trim();

        if (gitCommit) {
          return NextResponse.json({ version: gitCommit });
        }
      } catch (e2) {
        // Git not available
      }
    }

    // Fallback
    return NextResponse.json({ version: 'dev' });
  } catch (error) {
    console.error('[Version API] Error:', error);
    return NextResponse.json({ version: 'unknown' });
  }
}
