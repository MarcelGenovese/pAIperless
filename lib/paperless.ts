import { getConfig, getConfigSecure } from './config';

export class PaperlessClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  private async fetch(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Token ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Paperless API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async validateConnection(): Promise<boolean> {
    try {
      await this.fetch('/api/documents/?page=1&page_size=1');
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkWorkflows(names: string[]): Promise<{ name: string; exists: boolean }[]> {
    try {
      const workflows = await this.fetch('/api/workflows/');
      const existingNames = workflows.results.map((w: any) => w.name);

      return names.map(name => ({
        name,
        exists: existingNames.includes(name),
      }));
    } catch (error) {
      console.error('Error checking workflows:', error);
      return names.map(name => ({ name, exists: false }));
    }
  }

  /**
   * Get Paperless configuration including OCR settings
   */
  async getConfiguration(): Promise<any> {
    try {
      const config = await this.fetch('/api/config/');
      return config;
    } catch (error) {
      console.error('Error getting configuration:', error);
      throw error;
    }
  }

  /**
   * Check OCR mode configuration
   * Returns the OCR mode: 'skip', 'redo', 'skip_noarchive', 'force'
   */
  async getOCRMode(): Promise<string> {
    try {
      const config = await this.getConfiguration();
      // Paperless stores OCR mode in settings
      // Possible values: skip, redo, skip_noarchive, force
      return config.ocr_mode || 'skip';
    } catch (error) {
      console.error('Error getting OCR mode:', error);
      return 'unknown';
    }
  }

  /**
   * Verify that Paperless is configured to skip OCR for documents with existing text
   * This is CRITICAL to prevent Paperless from overwriting Document AI OCR results
   */
  async verifyOCRSettings(): Promise<{ valid: boolean; mode: string; message: string }> {
    try {
      const ocrMode = await this.getOCRMode();

      // Valid modes for pAIperless: skip, skip_noarchive
      // These modes will skip OCR if text already exists
      const validModes = ['skip', 'skip_noarchive'];
      const isValid = validModes.includes(ocrMode);

      if (isValid) {
        return {
          valid: true,
          mode: ocrMode,
          message: `OCR mode is "${ocrMode}" - Paperless will skip OCR for documents with existing text`,
        };
      } else {
        return {
          valid: false,
          mode: ocrMode,
          message: `OCR mode is "${ocrMode}" - Paperless may overwrite Document AI results! Please set to "skip" or "skip_noarchive"`,
        };
      }
    } catch (error: any) {
      return {
        valid: false,
        mode: 'unknown',
        message: `Failed to verify OCR settings: ${error.message}`,
      };
    }
  }

  async getTagId(tagName: string): Promise<number | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags/?name=${encodeURIComponent(tagName)}`, {
        headers: {
          'Authorization': `Token ${this.token}`,
        },
      });

      if (!response.ok) {
        console.error(`[Paperless] Failed to fetch tag: ${tagName}`);
        return null;
      }

      const data = await response.json();
      if (data.results && data.results.length > 0) {
        return data.results[0].id;
      }

      return null;
    } catch (error) {
      console.error(`[Paperless] Error fetching tag ${tagName}:`, error);
      return null;
    }
  }

  async uploadDocument(filePath: string, tagNames: string[] = []): Promise<number> {
    const fs = await import('fs').then(m => m.promises);
    const path = await import('path');

    const fileBuffer = await fs.readFile(filePath);
    const fileName = path.basename(filePath);

    const formData = new FormData();
    formData.append('document', new Blob([fileBuffer]), fileName);

    // Convert tag names to IDs
    if (tagNames.length > 0) {
      const tagIds: number[] = [];
      for (const tagName of tagNames) {
        const tagId = await this.getTagId(tagName);
        if (tagId) {
          tagIds.push(tagId);
        } else {
          console.warn(`[Paperless] Tag '${tagName}' not found, skipping`);
        }
      }

      if (tagIds.length > 0) {
        formData.append('tags', tagIds.join(','));
      }
    }

    const response = await fetch(`${this.baseUrl}/api/documents/post_document/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Paperless] Upload failed: ${response.status} - ${errorText}`);
      throw new Error(`Failed to upload document: ${response.status}`);
    }

    const data = await response.json();
    return data.id;
  }

  /**
   * Get all tags from Paperless
   */
  async getTags(): Promise<Array<{ id: number; name: string }>> {
    try {
      const data = await this.fetch('/api/tags/?page_size=1000');
      return data.results.map((tag: any) => ({
        id: tag.id,
        name: tag.name,
      }));
    } catch (error) {
      console.error('Error fetching tags:', error);
      return [];
    }
  }

  /**
   * Get all correspondents from Paperless
   */
  async getCorrespondents(): Promise<Array<{ id: number; name: string }>> {
    try {
      const data = await this.fetch('/api/correspondents/?page_size=1000');
      return data.results.map((correspondent: any) => ({
        id: correspondent.id,
        name: correspondent.name,
      }));
    } catch (error) {
      console.error('Error fetching correspondents:', error);
      return [];
    }
  }

  /**
   * Get all document types from Paperless
   */
  async getDocumentTypes(): Promise<Array<{ id: number; name: string }>> {
    try {
      const data = await this.fetch('/api/document_types/?page_size=1000');
      return data.results.map((type: any) => ({
        id: type.id,
        name: type.name,
      }));
    } catch (error) {
      console.error('Error fetching document types:', error);
      return [];
    }
  }

  /**
   * Get all custom fields from Paperless
   */
  async getCustomFields(): Promise<Array<{ id: number; name: string; data_type: string }>> {
    try {
      const data = await this.fetch('/api/custom_fields/?page_size=1000');
      return data.results.map((field: any) => ({
        id: field.id,
        name: field.name,
        data_type: field.data_type,
      }));
    } catch (error) {
      console.error('Error fetching custom fields:', error);
      return [];
    }
  }

  /**
   * Get all storage paths from Paperless
   */
  async getStoragePaths(): Promise<Array<{ id: number; name: string }>> {
    try {
      const data = await this.fetch('/api/storage_paths/?page_size=1000');
      return data.results.map((path: any) => ({
        id: path.id,
        name: path.name,
      }));
    } catch (error) {
      console.error('Error fetching storage paths:', error);
      return [];
    }
  }
}

export async function getPaperlessClient(): Promise<PaperlessClient> {
  const url = await getConfig('PAPERLESS_URL');
  const token = await getConfigSecure('PAPERLESS_TOKEN');

  if (!url || !token) {
    throw new Error('Paperless not configured');
  }

  return new PaperlessClient(url, token);
}
