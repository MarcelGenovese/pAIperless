import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';

export const runtime = 'nodejs';

const STORAGE_BASE = '/app/storage';
const logger = createLogger('ClearFolder');

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

    await logger.info(`Clearing folder: ${folder}`);

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

    // If clearing error folder, also delete ERROR documents from database
    if (folder === 'error') {
      await logger.info(`Deleting ERROR documents from database`);
      const dbDeleted = await prisma.document.deleteMany({
        where: {
          status: 'ERROR'
        }
      });
      await logger.info(`Deleted ${dbDeleted.count} ERROR documents from database`);
    }

    await logger.info(`Cleared ${deleted} files from ${folder} folder`);

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
