import { NextResponse } from 'next/server';
import { getPaperlessClient } from '@/lib/paperless';

export const runtime = 'nodejs';

/**
 * Check Paperless OCR settings to ensure it won't overwrite Document AI results
 */
export async function GET() {
  try {
    const paperless = await getPaperlessClient();
    const result = await paperless.verifyOCRSettings();

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to check OCR settings', detail: error.message },
      { status: 500 }
    );
  }
}
