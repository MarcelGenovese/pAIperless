import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

/**
 * Delete a file from the error folder
 */
export async function POST(request: NextRequest) {
  try {
    const { filename } = await request.json();

    if (!filename) {
      return NextResponse.json(
        { error: 'Dateiname fehlt' },
        { status: 400 }
      );
    }

    // Determine error directory
    const baseDir = process.env.STORAGE_DIR || '/app/storage';
    const devMode = !existsSync('/app/storage') && existsSync('./test-error');
    const errorDir = devMode ? './test-error' : path.join(baseDir, 'error');

    const filePath = path.join(errorDir, filename);

    // Security check: ensure file is within error directory
    if (!filePath.startsWith(errorDir)) {
      return NextResponse.json(
        { error: 'Ungültiger Dateipfad' },
        { status: 400 }
      );
    }

    // Check if file exists
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Datei nicht gefunden' },
        { status: 404 }
      );
    }

    // Delete file
    await unlink(filePath);
    console.log(`[Delete Error] Deleted file: ${filePath}`);

    return NextResponse.json({
      success: true,
      message: 'Datei erfolgreich gelöscht',
    });
  } catch (error: any) {
    console.error('[Delete Error] Error:', error);
    return NextResponse.json(
      { error: 'Fehler beim Löschen: ' + error.message },
      { status: 500 }
    );
  }
}
