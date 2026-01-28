import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

/**
 * Upload documents to consume folder
 * Handles single and multiple file uploads
 */
export async function POST(request: NextRequest) {
  console.log('[Upload] Starting upload process...');

  // Check authentication via session cookie (not using getToken to avoid body consumption)
  const sessionToken = request.cookies.get('next-auth.session-token')?.value;

  if (!sessionToken) {
    console.log('[Upload] Unauthorized - No session token cookie');
    return NextResponse.json(
      { error: 'Unauthorized - Please login again' },
      { status: 401 }
    );
  }

  console.log('[Upload] Session token found, proceeding with upload');

  try {
    const formData = await request.formData();
    console.log('[Upload] FormData received');

    const files = formData.getAll('files') as File[];
    console.log(`[Upload] Number of files: ${files.length}`);

    if (!files || files.length === 0) {
      console.log('[Upload] No files in request');
      return NextResponse.json(
        { error: 'Keine Dateien hochgeladen' },
        { status: 400 }
      );
    }

    // Determine consume directory
    let consumeDir = process.env.CONSUME_DIR || '/app/storage/consume';

    // Check if we're in development mode (not in Docker)
    if (!existsSync('/app/storage') && existsSync('./test-consume')) {
      consumeDir = './test-consume';
      console.log('[Upload] Using development mode: ./test-consume');
    }

    console.log(`[Upload] Target directory: ${consumeDir}`);

    // Ensure consume directory exists with proper permissions
    try {
      if (!existsSync(consumeDir)) {
        console.log(`[Upload] Creating directory: ${consumeDir}`);
        await mkdir(consumeDir, { recursive: true, mode: 0o777 });
      }

      // Verify directory is writable
      const testFile = path.join(consumeDir, '.write-test');
      try {
        await writeFile(testFile, 'test', { mode: 0o666 });
        await import('fs').then(fs => fs.promises.unlink(testFile));
        console.log(`[Upload] Directory is writable: ${consumeDir}`);
      } catch (writeError: any) {
        console.error(`[Upload] Directory not writable: ${consumeDir}`, writeError);
        return NextResponse.json(
          { error: `Upload-Verzeichnis nicht beschreibbar: ${writeError.message}` },
          { status: 500 }
        );
      }
    } catch (mkdirError: any) {
      console.error(`[Upload] Failed to create directory: ${consumeDir}`, mkdirError);
      return NextResponse.json(
        { error: `Verzeichnis konnte nicht erstellt werden: ${mkdirError.message}` },
        { status: 500 }
      );
    }

    const uploadedFiles: string[] = [];
    const errors: { filename: string; error: string }[] = [];

    for (const file of files) {
      try {
        // Validate file type (only PDFs)
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          errors.push({
            filename: file.name,
            error: 'Nur PDF-Dateien sind erlaubt'
          });
          continue;
        }

        // Validate file size (max 100MB)
        if (file.size > 100 * 1024 * 1024) {
          errors.push({
            filename: file.name,
            error: 'Datei ist zu groß (max. 100MB)'
          });
          continue;
        }

        // Read file data
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Generate safe filename (avoid overwrites)
        const originalName = file.name;
        let filename = originalName;
        let counter = 1;
        let targetPath = path.join(consumeDir, filename);

        while (existsSync(targetPath)) {
          const ext = path.extname(originalName);
          const base = path.basename(originalName, ext);
          filename = `${base}_${counter}${ext}`;
          targetPath = path.join(consumeDir, filename);
          counter++;
        }

        // Write file to consume directory
        await writeFile(targetPath, buffer, { mode: 0o666 });

        uploadedFiles.push(filename);
        console.log(`[Upload] File saved: ${targetPath}`);
      } catch (error: any) {
        console.error(`[Upload] Failed to upload ${file.name}:`, error);
        errors.push({
          filename: file.name,
          error: error.message || 'Unbekannter Fehler'
        });
      }
    }

    // Return results
    if (uploadedFiles.length === 0 && errors.length > 0) {
      return NextResponse.json(
        {
          error: 'Alle Uploads fehlgeschlagen',
          errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      uploaded: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined,
      message: `${uploadedFiles.length} Datei(en) erfolgreich hochgeladen`
    });
  } catch (error: any) {
    console.error('[Upload] Error:', error);
    return NextResponse.json(
      { error: 'Upload fehlgeschlagen: ' + error.message },
      { status: 500 }
    );
  }
}
