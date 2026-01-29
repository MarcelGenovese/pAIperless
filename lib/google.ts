import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import type { protos } from '@google-cloud/documentai';
import { getConfig, getConfigSecure, CONFIG_KEYS } from './config';
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { createLogger } from './logger';

const logger = createLogger('DocumentAI');

type Document = protos.google.cloud.documentai.v1.IDocument;

/**
 * Process document with Google Document AI
 * Returns the full Document object with text, pages, and bounding boxes
 */
export async function processWithDocumentAI(filePath: string): Promise<Document> {
  try {
    // Get configuration
    const projectId = await getConfig(CONFIG_KEYS.GOOGLE_CLOUD_PROJECT_ID);
    const location = await getConfig(CONFIG_KEYS.DOCUMENT_AI_LOCATION) || 'eu';
    const processorId = await getConfig(CONFIG_KEYS.DOCUMENT_AI_PROCESSOR_ID);
    const credentialsJson = await getConfigSecure(CONFIG_KEYS.GOOGLE_CLOUD_CREDENTIALS);

    if (!projectId || !processorId || !credentialsJson) {
      throw new Error('Document AI not configured');
    }

    const credentials = JSON.parse(credentialsJson);

    // Set regional endpoint
    const apiEndpoint = `${location}-documentai.googleapis.com`;

    // Override project_id in credentials to use the configured one
    const credentialsWithProjectId = {
      ...credentials,
      project_id: projectId,
    };

    await logger.info('Initializing Document AI client', { location, processorId: processorId.substring(0, 8) + '...' });

    // WORKING SOLUTION: Use fallback: true to enforce REST instead of gRPC
    const client = new DocumentProcessorServiceClient({
      apiEndpoint: apiEndpoint,
      credentials: credentialsWithProjectId,
      projectId: projectId,
      fallback: true, // Forces REST, which respects apiEndpoint
    });

    // Read file
    const fs = await import('fs').then(m => m.promises);
    const fileBuffer = await fs.readFile(filePath);

    await logger.info(`Sending ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB to Document AI...`);

    // Process document
    const name = client.processorPath(projectId, location, processorId);
    const [result] = await client.processDocument({
      name,
      rawDocument: {
        content: fileBuffer.toString('base64'),
        mimeType: 'application/pdf',
      },
    });

    if (!result.document) {
      throw new Error('Document AI returned no document');
    }

    await logger.info(`Document AI processing complete: ${result.document.text?.length || 0} characters extracted`);

    return result.document;
  } catch (error: any) {
    await logger.error('Document AI processing error', error);
    throw error;
  }
}

/**
 * Create searchable PDF from Document AI result
 * Uses Python script to embed OCR text layer with proper PDF Render Mode 3
 */
export async function createSearchablePDF(
  inputPath: string,
  docAIResult: Document,
  outputPath: string
): Promise<void> {
  try {
    await logger.info('Creating searchable PDF with proper OCR layer...');

    // Save Document AI result as JSON for Python script
    const tempJsonPath = inputPath + '.docai.json';

    // Convert Document AI result to serializable JSON
    const serializedResult = JSON.parse(JSON.stringify(docAIResult));
    writeFileSync(tempJsonPath, JSON.stringify(serializedResult, null, 2));

    await logger.info(`Document AI data saved to: ${tempJsonPath}`);

    // Determine script path
    const scriptPath = process.env.NODE_ENV === 'production'
      ? '/app/scripts/embed-ocr-layer.py'
      : join(process.cwd(), 'scripts', 'embed-ocr-layer.py');

    // Call Python script to embed OCR layer
    await logger.info(`Running OCR embedding script: ${scriptPath}`);

    try {
      const output = execSync(
        `python3 "${scriptPath}" "${inputPath}" "${tempJsonPath}" "${outputPath}"`,
        {
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        }
      );

      await logger.info(`Python script output: ${output.trim()}`);
    } catch (execError: any) {
      // Log stderr if available
      if (execError.stderr) {
        await logger.error(`Python script stderr: ${execError.stderr}`);
      }
      if (execError.stdout) {
        await logger.info(`Python script stdout: ${execError.stdout}`);
      }
      throw new Error(`OCR embedding script failed: ${execError.message}`);
    }

    // Clean up temporary JSON file
    try {
      const fs = await import('fs').then(m => m.promises);
      await fs.unlink(tempJsonPath);
    } catch (cleanupError) {
      await logger.warn('Failed to clean up temporary JSON file', cleanupError);
    }

    // Verify output was created
    const fs = await import('fs').then(m => m.promises);
    const stats = await fs.stat(outputPath);
    await logger.info(`Searchable PDF created: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  } catch (error: any) {
    await logger.error('Failed to create searchable PDF', error);
    throw error;
  }
}
