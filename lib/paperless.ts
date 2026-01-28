import { getConfig } from './config';

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

  async uploadDocument(filePath: string, tags: string[] = []): Promise<number> {
    const fs = await import('fs').then(m => m.promises);
    const path = await import('path');
    
    const fileBuffer = await fs.readFile(filePath);
    const fileName = path.basename(filePath);

    const formData = new FormData();
    formData.append('document', new Blob([fileBuffer]), fileName);
    
    if (tags.length > 0) {
      formData.append('tags', tags.join(','));
    }

    const response = await fetch(`${this.baseUrl}/api/documents/post_document/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload document: ${response.status}`);
    }

    const data = await response.json();
    return data.id;
  }
}

export async function getPaperlessClient(): Promise<PaperlessClient> {
  const url = await getConfig('PAPERLESS_URL');
  const token = await getConfig('PAPERLESS_TOKEN');

  if (!url || !token) {
    throw new Error('Paperless not configured');
  }

  return new PaperlessClient(url, token);
}
