import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const STORAGE_BASE = '/app/storage';

export async function POST(request: NextRequest) {
  try {
    const { folder } = await request.json();

    if (!folder || !['consume', 'processing', 'error'].includes(folder)) {
      return NextResponse.json(
        { error: 'Invalid folder name' },
        { status: 400 }
      );
    }

    const folderPath = path.join(STORAGE_BASE, folder);

    // Read all files in the folder
    const files = await fs.readdir(folderPath);

    // Delete all files
    let deleted = 0;
    for (const file of files) {
      try {
        await fs.unlink(path.join(folderPath, file));
        deleted++;
      } catch (error) {
        console.error(`Failed to delete file ${file}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      deleted,
      folder
    });
  } catch (error: any) {
    console.error('Clear folder error:', error);
    return NextResponse.json(
      { error: 'Failed to clear folder', detail: error.message },
      { status: 500 }
    );
  }
}
