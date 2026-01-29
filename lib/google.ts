import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import type { protos } from '@google-cloud/documentai';
import { getConfig, getConfigSecure, CONFIG_KEYS } from './config';
import { PDFDocument } from 'pdf-lib';
import { readFileSync, writeFileSync } from 'fs';
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
 * Embeds OCR text layer into PDF pages
 */
export async function createSearchablePDF(
  inputPath: string,
  docAIResult: Document,
  outputPath: string
): Promise<void> {
  try {
    await logger.info('Creating searchable PDF...');

    // Load the input PDF
    const pdfBytes = readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    const fullText = docAIResult.text || '';
    const docAIPages = docAIResult.pages || [];

    await logger.info(`Processing ${pages.length} pages with ${docAIPages.length} OCR pages`);

    // For each page, add invisible text layer at token positions
    for (let pageIdx = 0; pageIdx < Math.min(pages.length, docAIPages.length); pageIdx++) {
      const page = pages[pageIdx];
      const docAIPage = docAIPages[pageIdx];
      const { width: pageWidth, height: pageHeight } = page.getSize();

      if (!docAIPage.tokens) continue;

      let tokensAdded = 0;

      // Add each token as invisible text at its position
      for (const token of docAIPage.tokens) {
        try {
          if (!token.layout?.textAnchor?.textSegments?.[0]) continue;

          const segment = token.layout.textAnchor.textSegments[0];
          const startIndex = parseInt(segment.startIndex?.toString() || '0');
          const endIndex = parseInt(segment.endIndex?.toString() || '0');
          const tokenText = fullText.substring(startIndex, endIndex).replace(/\n/g, '').trim();

          if (!tokenText) continue;

          const vertices = token.layout.boundingPoly?.normalizedVertices;
          if (!vertices || vertices.length < 3) continue;

          // Calculate bounding box
          const x = (vertices[0].x || 0) * pageWidth;
          const y = pageHeight - (vertices[0].y || 0) * pageHeight; // Flip Y coordinate
          const width = ((vertices[2].x || 0) - (vertices[0].x || 0)) * pageWidth;
          const height = ((vertices[2].y || 0) - (vertices[0].y || 0)) * pageHeight;

          // Add invisible text at token position
          // Note: pdf-lib doesn't support render mode 3 (invisible text) directly
          // We'll add very small, transparent text instead
          const fontSize = Math.max(1, height * 0.75);

          page.drawText(tokenText, {
            x,
            y: y - height,
            size: fontSize,
            opacity: 0, // Make text invisible
          });

          tokensAdded++;
        } catch (err) {
          // Skip token on error
          continue;
        }
      }

      await logger.debug(`Page ${pageIdx + 1}: Added ${tokensAdded} text tokens`);
    }

    // Save the PDF with embedded OCR
    const outputBytes = await pdfDoc.save();
    writeFileSync(outputPath, outputBytes);

    await logger.info(`Searchable PDF created: ${outputPath} (${(outputBytes.length / 1024 / 1024).toFixed(2)} MB)`);
  } catch (error: any) {
    await logger.error('Failed to create searchable PDF', error);
    throw error;
  }
}
