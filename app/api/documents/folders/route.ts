import { NextResponse } from 'next/server';
import { readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

interface FileInfo {
  name: string;
  size: number;
  createdAt: string;
  path: string;
}

interface FolderContents {
  consume: FileInfo[];
  processing: FileInfo[];
  error: FileInfo[];
}

/**
 * Get contents of consume, processing, and error folders
 */
export async function GET() {
  try {
    // Determine directories
    const baseDir = process.env.STORAGE_DIR || '/app/storage';
    const devMode = !existsSync('/app/storage') && existsSync('./test-consume');

    const consumeDir = devMode ? './test-consume' : path.join(baseDir, 'consume');
    const processingDir = devMode ? './test-processing' : path.join(baseDir, 'processing');
    const errorDir = devMode ? './test-error' : path.join(baseDir, 'error');

    const result: FolderContents = {
      consume: [],
      processing: [],
      error: [],
    };

    // Helper function to read directory contents
    const readFolderContents = async (dir: string): Promise<FileInfo[]> => {
      try {
        if (!existsSync(dir)) {
          return [];
        }

        const files = await readdir(dir);
        const fileInfos: FileInfo[] = [];

        for (const file of files) {
          try {
            const filePath = path.join(dir, file);
            const stats = await stat(filePath);

            if (stats.isFile()) {
              fileInfos.push({
                name: file,
                size: stats.size,
                createdAt: stats.birthtime.toISOString(),
                path: filePath,
              });
            }
          } catch (error) {
            console.error(`Error reading file ${file}:`, error);
          }
        }

        // Sort by creation time (newest first)
        return fileInfos.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      } catch (error) {
        console.error(`Error reading directory ${dir}:`, error);
        return [];
      }
    };

    // Read all three folders
    const [consume, processing, error] = await Promise.all([
      readFolderContents(consumeDir),
      readFolderContents(processingDir),
      readFolderContents(errorDir),
    ]);

    result.consume = consume;
    result.processing = processing;
    result.error = error;

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Documents/Folders] Error:', error);
    return NextResponse.json(
      { error: 'Fehler beim Lesen der Ordner: ' + error.message },
      { status: 500 }
    );
  }
}
