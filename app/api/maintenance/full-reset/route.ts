import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { unlink, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

/**
 * Complete reset - delete all document history and clear all folders
 * WARNING: This is a destructive operation!
 */
export async function POST() {
  try {
    const stats = {
      documentsDeleted: 0,
      logsDeleted: 0,
      filesDeleted: 0,
      foldersCleared: [] as string[],
    };

    // 1. Delete ALL documents from database
    const documentsResult = await prisma.document.deleteMany({});
    stats.documentsDeleted = documentsResult.count;

    // 2. Delete document-related logs (keep system logs)
    const logsResult = await prisma.log.deleteMany({
      where: {
        OR: [
          { message: { contains: 'Document' } },
          { message: { contains: 'document' } },
          { message: { contains: 'Dokument' } },
        ]
      }
    });
    stats.logsDeleted = logsResult.count;

    // 3. Clear all processing folders
    const baseDir = process.env.STORAGE_DIR || '/app/storage';
    const foldersToClean = ['consume', 'processing', 'error', 'completed'];

    for (const folder of foldersToClean) {
      const folderPath = path.join(baseDir, folder);

      if (!existsSync(folderPath)) {
        continue;
      }

      try {
        const files = await readdir(folderPath);

        for (const file of files) {
          try {
            await unlink(path.join(folderPath, file));
            stats.filesDeleted++;
          } catch (error) {
            console.error(`Failed to delete ${file}:`, error);
          }
        }

        stats.foldersCleared.push(folder);
      } catch (error) {
        console.error(`Failed to clear folder ${folder}:`, error);
      }
    }

    // 4. Reset cost tracking for current month (optional - keep for accounting)
    // We'll keep cost tracking intact

    return NextResponse.json({
      success: true,
      ...stats,
      message: `Komplette Bereinigung abgeschlossen: ${stats.documentsDeleted} Dokumente, ${stats.filesDeleted} Dateien gelöscht`
    });
  } catch (error: any) {
    console.error('[Maintenance/Full-Reset] Error:', error);
    return NextResponse.json(
      { error: 'Fehler bei kompletter Bereinigung: ' + error.message },
      { status: 500 }
    );
  }
}
