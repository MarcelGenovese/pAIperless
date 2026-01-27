import { NextRequest, NextResponse } from 'next/server';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { readFileSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, processorId, location, credentials, testType } = body;

    if (!projectId || !processorId || !location || !credentials) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Parse and validate credentials
    let credentialsObj;
    try {
      credentialsObj = typeof credentials === 'string'
        ? JSON.parse(credentials)
        : credentials;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid credentials JSON format' },
        { status: 400 }
      );
    }

    // Initialize Document AI client
    const client = new DocumentProcessorServiceClient({
      credentials: credentialsObj,
      projectId: projectId,
    });

    const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`;

    if (testType === 'connection') {
      // Test connection by getting processor info
      try {
        const [processor] = await client.getProcessor({
          name: processorName,
        });

        return NextResponse.json({
          success: true,
          processor: {
            name: processor.name,
            displayName: processor.displayName,
            type: processor.type,
            state: processor.state,
          }
        });
      } catch (error: any) {
        console.error('Document AI connection test failed:', error);

        let errorMessage = 'Failed to connect to Document AI processor';
        if (error.code === 5) {
          errorMessage = 'Processor not found. Please check your Project ID, Location, and Processor ID.';
        } else if (error.code === 7) {
          errorMessage = 'Permission denied. Please check your service account permissions.';
        } else if (error.message) {
          errorMessage = error.message;
        }

        return NextResponse.json(
          { error: errorMessage, code: error.code },
          { status: 400 }
        );
      }
    } else if (testType === 'ocr') {
      // Test OCR with test.pdf
      try {
        const testPdfPath = join(process.cwd(), 'public', 'test.pdf');

        let fileBuffer: Buffer;
        try {
          fileBuffer = readFileSync(testPdfPath);
        } catch (error) {
          return NextResponse.json(
            { error: 'test.pdf not found in public folder. Please ensure it exists.' },
            { status: 400 }
          );
        }

        // Process document
        const [result] = await client.processDocument({
          name: processorName,
          rawDocument: {
            content: fileBuffer.toString('base64'),
            mimeType: 'application/pdf',
          },
        });

        if (!result.document) {
          return NextResponse.json(
            { error: 'No document returned from Document AI' },
            { status: 500 }
          );
        }

        const text = result.document.text || '';
        const pages = result.document.pages?.length || 0;

        return NextResponse.json({
          success: true,
          text: text,
          pageCount: pages,
          characterCount: text.length,
        });
      } catch (error: any) {
        console.error('Document AI OCR test failed:', error);

        let errorMessage = 'Failed to process document with Document AI';
        if (error.code === 3) {
          errorMessage = 'Invalid document format or corrupted PDF';
        } else if (error.code === 8) {
          errorMessage = 'Resource exhausted. You may have exceeded quota limits.';
        } else if (error.message) {
          errorMessage = error.message;
        }

        return NextResponse.json(
          { error: errorMessage, code: error.code },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid test type. Must be "connection" or "ocr".' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Document AI test error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
