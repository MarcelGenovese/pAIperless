import { NextRequest, NextResponse } from 'next/server';
import { unlink, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

/**
 * Clear files from specific folders (consume, processing, error)
 */
export async function POST(request: NextRequest) {
  try {
    const { folders } = await request.json();

    if (!folders || !Array.isArray(folders)) {
      return NextResponse.json(
        { error: 'Bitte geben Sie die zu bereinigenden Ordner an' },
        { status: 400 }
      );
    }

    const baseDir = process.env.STORAGE_DIR || '/app/storage';
    const validFolders = ['consume', 'processing', 'error', 'completed'];

    let totalDeleted = 0;
    const results: Record<string, number> = {};

    for (const folder of folders) {
      if (!validFolders.includes(folder)) {
        continue;
      }

      const folderPath = path.join(baseDir, folder);

      if (!existsSync(folderPath)) {
        results[folder] = 0;
        continue;
      }

      const files = await readdir(folderPath);
      let deletedCount = 0;

      for (const file of files) {
        try {
          await unlink(path.join(folderPath, file));
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete ${file}:`, error);
        }
      }

      results[folder] = deletedCount;
      totalDeleted += deletedCount;
    }

    return NextResponse.json({
      success: true,
      totalDeleted,
      results,
      message: `${totalDeleted} Datei(en) erfolgreich gelöscht`
    });
  } catch (error: any) {
    console.error('[Maintenance/Clear-Folders] Error:', error);
    return NextResponse.json(
      { error: 'Fehler beim Leeren der Ordner: ' + error.message },
      { status: 500 }
    );
  }
}
