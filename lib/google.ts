import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { getConfig } from './config';

export async function processWithDocumentAI(filePath: string): Promise<string> {
  try {
    // Get configuration
    const projectId = await getConfig('GCP_PROJECT_ID');
    const location = await getConfig('GCP_LOCATION') || 'eu';
    const processorId = await getConfig('GCP_PROCESSOR_ID');
    const credentialsJson = await getConfig('GOOGLE_CREDENTIALS');

    if (!projectId || !processorId || !credentialsJson) {
      throw new Error('Document AI not configured');
    }

    const credentials = JSON.parse(credentialsJson);

    // Set regional endpoint
    const apiEndpoint = location === 'eu'
      ? 'eu-documentai.googleapis.com'
      : 'us-documentai.googleapis.com';

    // Override project_id in credentials to use the configured one
    const credentialsWithProjectId = {
      ...credentials,
      project_id: projectId,
    };

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

    // Process document
    const name = client.processorPath(projectId, location, processorId);
    const [result] = await client.processDocument({
      name,
      rawDocument: {
        content: fileBuffer.toString('base64'),
        mimeType: 'application/pdf',
      },
    });

    return result.document?.text || '';
  } catch (error) {
    console.error('Document AI processing error:', error);
    throw error;
  }
}
