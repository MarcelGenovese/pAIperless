import { NextRequest, NextResponse } from 'next/server';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { readFileSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  console.log('Document AI test endpoint called');
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      // No body provided, will use config
    }

    let { projectId, processorId, location, credentials, testType } = body;

    // If not provided in request, try to get from config
    if (!projectId || !processorId || !location || !credentials) {
      const { getConfig, getConfigSecure, CONFIG_KEYS } = await import('@/lib/config');

      // Check if Document AI is enabled
      const enabled = await getConfig(CONFIG_KEYS.DOCUMENT_AI_ENABLED);
      if (enabled !== 'true') {
        return NextResponse.json({ inactive: true });
      }

      if (!projectId) {
        projectId = await getConfig(CONFIG_KEYS.GOOGLE_CLOUD_PROJECT_ID);
      }
      if (!processorId) {
        processorId = await getConfig(CONFIG_KEYS.DOCUMENT_AI_PROCESSOR_ID);
      }
      if (!location) {
        location = await getConfig(CONFIG_KEYS.DOCUMENT_AI_LOCATION);
      }
      if (!credentials) {
        credentials = await getConfigSecure(CONFIG_KEYS.GOOGLE_CLOUD_CREDENTIALS);
      }
    }

    console.log('=== API RECEIVED DATA ===');
    console.log('projectId:', projectId);
    console.log('processorId:', processorId);
    console.log('location:', location);
    console.log('testType:', testType);
    console.log('credentials exists:', !!credentials);
    console.log('credentials type:', typeof credentials);
    console.log('credentials length:', credentials?.length || 0);
    console.log('credentials first 100 chars:', typeof credentials === 'string' ? credentials.substring(0, 100) : 'NOT A STRING');

    if (!projectId || !processorId || !location || !credentials) {
      console.error('Missing fields:', { projectId: !!projectId, processorId: !!processorId, location: !!location, credentials: !!credentials });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Parse and validate credentials
    let credentialsObj;
    try {
      console.log('=== PARSING CREDENTIALS ===');
      credentialsObj = typeof credentials === 'string'
        ? JSON.parse(credentials)
        : credentials;

      console.log('Successfully parsed credentials');
      console.log('Parsed credentials keys:', Object.keys(credentialsObj || {}));
      console.log('Parsed credentials, client_email:', credentialsObj?.client_email);
      console.log('Parsed credentials, project_id:', credentialsObj?.project_id);
      console.log('Parsed credentials, type:', credentialsObj?.type);

      // Validate required fields
      if (!credentialsObj?.client_email) {
        console.error('Missing client_email in credentials');
        return NextResponse.json(
          { error: 'Service Account JSON is missing client_email field. Please ensure you uploaded a valid service account key file.' },
          { status: 400 }
        );
      }

      if (!credentialsObj?.private_key) {
        console.error('Missing private_key in credentials');
        return NextResponse.json(
          { error: 'Service Account JSON is missing private_key field. Please ensure you uploaded a valid service account key file.' },
          { status: 400 }
        );
      }

      if (credentialsObj?.type !== 'service_account') {
        console.error('Invalid credentials type:', credentialsObj?.type);
        return NextResponse.json(
          { error: 'Invalid credentials type. Expected "service_account", got: ' + (credentialsObj?.type || 'undefined') },
          { status: 400 }
        );
      }

    } catch (error: any) {
      console.error('Failed to parse credentials:', error.message);
      return NextResponse.json(
        { error: 'Invalid credentials JSON format: ' + error.message },
        { status: 400 }
      );
    }

    // Initialize Document AI client with regional endpoint
    console.log('Initializing Document AI client...');

    // Set the correct API endpoint based on location - EXACTLY like Python code
    const apiEndpoint = location === 'eu'
      ? 'eu-documentai.googleapis.com'
      : 'us-documentai.googleapis.com';

    console.log('Using API endpoint:', apiEndpoint);

    // Override project_id in credentials to use the user-provided one
    const credentialsWithProjectId = {
      ...credentialsObj,
      project_id: projectId,
    };

    // WORKING SOLUTION: Use fallback: true to enforce REST instead of gRPC
    // This makes apiEndpoint actually work!
    const client = new DocumentProcessorServiceClient({
      apiEndpoint: apiEndpoint,
      credentials: credentialsWithProjectId,
      projectId: projectId,
      fallback: true, // THIS IS THE KEY! Forces REST, which respects apiEndpoint
    });

    const tmpFile = null; // Not needed anymore

    // Use the client's built-in method to construct the processor path
    const processorName = client.processorPath(projectId, location, processorId);
    console.log('Processor name (from client method):', processorName);

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
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);

        let errorMessage = 'Failed to connect to Document AI processor';
        if (error.code === 5) {
          errorMessage = 'Processor not found. Please check your Project ID, Location, and Processor ID.';
        } else if (error.code === 7) {
          errorMessage = 'Permission denied. Please check your service account permissions.';
        } else if (error.code === 16) {
          errorMessage = 'Authentication failed. Please check your service account credentials.';
        } else if (error.message) {
          errorMessage = error.message;
        }

        console.error('Sending error response:', errorMessage);

        return NextResponse.json(
          { error: errorMessage },
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
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);

        let errorMessage = 'Failed to process document with Document AI';
        if (error.code === 3) {
          errorMessage = 'Invalid document format or corrupted PDF';
        } else if (error.code === 8) {
          errorMessage = 'Resource exhausted. You may have exceeded quota limits.';
        } else if (error.code === 16) {
          errorMessage = 'Authentication failed. Please check your service account credentials.';
        } else if (error.message) {
          errorMessage = error.message;
        }

        console.error('Sending OCR error response:', errorMessage);

        return NextResponse.json(
          { error: errorMessage },
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
