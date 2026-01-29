import { NextResponse } from 'next/server';
import { getPaperlessClient } from '@/lib/paperless';

export const runtime = 'nodejs';

/**
 * Get all metadata from Paperless for AI prompt generation
 * Returns: tags, correspondents, document types, custom fields, storage paths
 */
export async function GET() {
  try {
    const client = await getPaperlessClient();

    // Fetch all metadata in parallel
    const [tags, correspondents, documentTypes, customFields, storagePaths] = await Promise.all([
      client.getTags(),
      client.getCorrespondents(),
      client.getDocumentTypes(),
      client.getCustomFields(),
      client.getStoragePaths(),
    ]);

    return NextResponse.json({
      tags,
      correspondents,
      documentTypes,
      customFields,
      storagePaths,
    });
  } catch (error: any) {
    console.error('Failed to fetch Paperless metadata:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Paperless metadata' },
      { status: 500 }
    );
  }
}
