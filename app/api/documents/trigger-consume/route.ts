import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { createLogger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const logger = createLogger('TriggerConsume');
const CONSUME_DIR = '/app/consume';

/**
 * Manually trigger processing of all files in consume folder
 * POST /api/documents/trigger-consume
 */
export async function POST() {
  try {
    await logger.info('Manual processing trigger requested');

    // Check if consume directory exists
    try {
      await fs.access(CONSUME_DIR);
    } catch (error) {
      await logger.error('Consume directory not accessible', error);
      return NextResponse.json(
        { error: 'Consume directory not accessible' },
        { status: 500 }
      );
    }

    // Read all files in consume directory
    const files = await fs.readdir(CONSUME_DIR);
    const pdfFiles = files.filter(file =>
      file.toLowerCase().endsWith('.pdf') && !file.startsWith('.')
    );

    await logger.info(`Found ${pdfFiles.length} PDF files in consume folder`);

    if (pdfFiles.length === 0) {
      return NextResponse.json({
        message: 'Keine PDF-Dateien im Consume-Ordner gefunden',
        filesFound: 0
      });
    }

    // Touch each file to trigger chokidar events
    // This simulates a file modification which chokidar will detect
    const now = new Date();
    for (const file of pdfFiles) {
      const filePath = path.join(CONSUME_DIR, file);
      try {
        await fs.utimes(filePath, now, now);
        await logger.info(`Triggered processing for: ${file}`);
      } catch (error: any) {
        await logger.warn(`Failed to trigger ${file}: ${error.message}`);
      }
    }

    return NextResponse.json({
      message: `Verarbeitung für ${pdfFiles.length} Datei(en) ausgelöst`,
      filesFound: pdfFiles.length
    });

  } catch (error: any) {
    await logger.error('Failed to trigger manual processing', error);
    return NextResponse.json(
      { error: 'Failed to trigger processing', details: error.message },
      { status: 500 }
    );
  }
}
