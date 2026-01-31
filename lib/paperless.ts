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
      console.log(`[Paperless] getTagId("${tagName}") returned ${data.results?.length || 0} results:`, JSON.stringify(data.results?.slice(0, 3)));

      if (data.results && data.results.length > 0) {
        // Found tags - check for exact match
        const exactMatch = data.results.find((tag: any) => tag.name === tagName);
        if (exactMatch) {
          console.log(`[Paperless] Exact match for "${tagName}": ID ${exactMatch.id}`);
          return exactMatch.id;
        }

        // No exact match, return first result (partial match)
        console.log(`[Paperless] No exact match for "${tagName}", using first result: "${data.results[0].name}" (ID ${data.results[0].id})`);
        return data.results[0].id;
      }

      console.log(`[Paperless] No tag found for "${tagName}"`);
      return null;
    } catch (error) {
      console.error(`[Paperless] Error fetching tag ${tagName}:`, error);
      return null;
    }
  }

  /**
   * Poll task status until completion and return the document ID
   */
  private async waitForTask(taskId: string, maxWaitMs: number = 60000): Promise<number | null> {
    const startTime = Date.now();
    const pollInterval = 1000; // Poll every 1000ms

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const taskStatus = await this.fetch(`/api/tasks/?task_id=${taskId}`);

        // The tasks API returns a direct array, not an object with 'results'
        let tasks: any[] = [];
        if (Array.isArray(taskStatus)) {
          tasks = taskStatus;
        } else if (taskStatus.results && Array.isArray(taskStatus.results)) {
          // Fallback for different API versions
          tasks = taskStatus.results;
        }

        if (tasks.length > 0) {
          const task = tasks[0];
          console.log(`[Paperless] Task status: ${task.status}, related_document: ${task.related_document}`);

          if (task.status === 'SUCCESS') {
            // Task completed successfully
            // The related_document field contains the document ID as a string
            if (task.related_document) {
              const docId = typeof task.related_document === 'string'
                ? parseInt(task.related_document, 10)
                : task.related_document;
              console.log(`[Paperless] ✅ Task ${taskId} completed, document ID: ${docId}`);
              return docId;
            }
            // Task succeeded but no related_document field
            console.warn(`[Paperless] ⚠️  Task ${taskId} completed but no related_document field`);
            return null;
          } else if (task.status === 'FAILURE') {
            console.error(`[Paperless] ❌ Task ${taskId} failed:`, task.result);
            throw new Error(`Document processing task failed: ${task.result}`);
          }
          // Still PENDING or STARTED - continue polling
          console.log(`[Paperless] Task still in progress: ${task.status}`);
        } else {
          console.log(`[Paperless] No tasks found for task_id: ${taskId}`);
        }
      } catch (error: any) {
        console.error(`[Paperless] Error checking task status:`, error);
        console.error(`[Paperless] Error details:`, error.message);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    console.warn(`[Paperless] ⏱️  Task ${taskId} polling timeout after ${maxWaitMs}ms`);
    return null;
  }

  /**
   * Try to find recently uploaded document by filename
   * Used as fallback when task polling times out
   */
  private async findRecentDocumentByFilename(originalFilename: string): Promise<number | null> {
    try {
      console.log(`[Paperless] Searching for document with filename: ${originalFilename}`);

      // Get the most recent documents, ordered by creation date
      // We just uploaded, so it should be in the first few results
      const data = await this.fetch(
        `/api/documents/?ordering=-created&page_size=30`
      );

      if (data.results && data.results.length > 0) {
        console.log(`[Paperless] Found ${data.results.length} recent documents, searching for match...`);

        // Try to match by original filename (without extension and processing suffixes)
        const baseFilename = originalFilename
          .replace(/_searchable\.pdf$/i, '')
          .replace(/_no_ocr\.pdf$/i, '')
          .replace(/\.pdf$/i, '');

        console.log(`[Paperless] Looking for base filename: ${baseFilename}`);

        for (const doc of data.results) {
          const docTitle = (doc.title || doc.original_file_name || '').toLowerCase();
          const baseFilenameLower = baseFilename.toLowerCase();

          // Try multiple matching strategies
          if (
            docTitle.includes(baseFilenameLower) ||
            baseFilenameLower.includes(docTitle.replace(/\.pdf$/i, '')) ||
            docTitle === baseFilenameLower ||
            docTitle === `${baseFilenameLower}.pdf`
          ) {
            console.log(`[Paperless] ✅ Found document by filename match: ID ${doc.id}, title: "${doc.title || doc.original_file_name}"`);
            return doc.id;
          }
        }

        // If no filename match, return the most recent one as best guess
        console.warn(`[Paperless] ⚠️  No exact filename match, using most recent document: ID ${data.results[0].id}, title: "${data.results[0].title || data.results[0].original_file_name}"`);
        return data.results[0].id;
      }

      console.warn(`[Paperless] No recent documents found`);
      return null;
    } catch (error: any) {
      console.error(`[Paperless] Error finding recent document:`, error);
      console.error(`[Paperless] Error details:`, error.message);
      return null;
    }
  }

  async uploadDocument(filePath: string, tagNames: string[] = []): Promise<number | null> {
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
    console.log(`[Paperless] Upload response:`, JSON.stringify(data));

    // Paperless post_document can return:
    // 1. A task ID string (async processing)
    // 2. An object with { task_id: "..." } or { id: ... }
    let taskId: string | null = null;

    if (typeof data === 'string') {
      // Task ID returned as plain string
      taskId = data;
      console.log(`[Paperless] Document upload task created: ${taskId}`);
    } else if (data.task_id) {
      taskId = data.task_id;
      console.log(`[Paperless] Document upload task created: ${taskId}`);
    } else if (data.id) {
      // Direct document ID (synchronous processing)
      console.log(`[Paperless] Document created with ID: ${data.id}`);
      return data.id;
    }

    // If we have a task ID, poll for completion
    if (taskId) {
      console.log(`[Paperless] Polling task ${taskId} for document ID...`);
      const documentId = await this.waitForTask(taskId, 60000);

      // If polling timed out, try to find the document by filename
      if (documentId === null) {
        console.log(`[Paperless] Task polling timed out, attempting to find document by filename...`);
        const foundId = await this.findRecentDocumentByFilename(fileName);
        if (foundId) {
          console.log(`[Paperless] Successfully found document via fallback: ID ${foundId}`);
          return foundId;
        }
        console.warn(`[Paperless] Could not find document via fallback method`);
      }

      return documentId;
    }

    console.warn(`[Paperless] Upload completed but no document ID or task ID received`);
    return null;
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

  /**
   * Get documents with a specific tag
   */
  async getDocumentsByTag(tagId: number): Promise<Array<any>> {
    try {
      const data = await this.fetch(`/api/documents/?tags__id__in=${tagId}&page_size=100`);
      return data.results || [];
    } catch (error) {
      console.error(`Error fetching documents with tag ${tagId}:`, error);
      return [];
    }
  }

  /**
   * Get a single document by ID
   */
  async getDocument(documentId: number): Promise<any | null> {
    try {
      const data = await this.fetch(`/api/documents/${documentId}/`);
      return data;
    } catch (error) {
      console.error(`Error fetching document ${documentId}:`, error);
      return null;
    }
  }

  /**
   * Get document content (text) by ID
   */
  async getDocumentContent(documentId: number): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/documents/${documentId}/download/`, {
        headers: {
          'Authorization': `Token ${this.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download document: ${response.status}`);
      }

      // For now, we'll get the text from the metadata endpoint
      // Paperless stores extracted text in the document metadata
      const docData = await this.fetch(`/api/documents/${documentId}/`);
      return docData.content || '';
    } catch (error) {
      console.error(`Error fetching document ${documentId} content:`, error);
      throw error;
    }
  }

  /**
   * Update a document with new metadata
   */
  async updateDocument(documentId: number, updates: {
    title?: string;
    tags?: number[];
    correspondent?: number | null;
    document_type?: number | null;
    storage_path?: number | null;
    custom_fields?: Array<{ field: number; value: any }>;
  }): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/documents/${documentId}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update document: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error(`Error updating document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new tag
   */
  async createTag(name: string, color?: string): Promise<number> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, color: color || '#3498db' }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create tag: ${response.status}`);
      }

      const data = await response.json();
      return data.id;
    } catch (error) {
      console.error(`Error creating tag ${name}:`, error);
      throw error;
    }
  }

  /**
   * Create or get correspondent by name
   */
  async createOrGetCorrespondent(name: string): Promise<number> {
    try {
      // First try to find existing
      const correspondents = await this.getCorrespondents();
      const existing = correspondents.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        return existing.id;
      }

      // Create new
      const response = await fetch(`${this.baseUrl}/api/correspondents/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create correspondent: ${response.status}`);
      }

      const data = await response.json();
      return data.id;
    } catch (error) {
      console.error(`Error creating correspondent ${name}:`, error);
      throw error;
    }
  }

  /**
   * Create or get document type by name
   */
  async createOrGetDocumentType(name: string): Promise<number> {
    try {
      // First try to find existing
      const types = await this.getDocumentTypes();
      const existing = types.find(t => t.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        return existing.id;
      }

      // Create new
      const response = await fetch(`${this.baseUrl}/api/document_types/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create document type: ${response.status}`);
      }

      const data = await response.json();
      return data.id;
    } catch (error) {
      console.error(`Error creating document type ${name}:`, error);
      throw error;
    }
  }

  /**
   * Create or get storage path by name
   */
  async createOrGetStoragePath(name: string): Promise<number> {
    try {
      // First try to find existing
      const paths = await this.getStoragePaths();
      const existing = paths.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        return existing.id;
      }

      // Create new
      const response = await fetch(`${this.baseUrl}/api/storage_paths/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, path: name }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create storage path: ${response.status}`);
      }

      const data = await response.json();
      return data.id;
    } catch (error) {
      console.error(`Error creating storage path ${name}:`, error);
      throw error;
    }
  }

  /**
   * Create or get tag by name
   */
  async createOrGetTag(name: string): Promise<number> {
    try {
      // Fetch all tags and search in-memory (Paperless API name filter doesn't work reliably)
      const allTags = await this.getTags();
      const existingTag = allTags.find(tag => tag.name.toLowerCase() === name.toLowerCase());

      if (existingTag) {
        console.log(`[Paperless] Found existing tag "${name}" with ID ${existingTag.id}`);
        return existingTag.id;
      }

      console.log(`[Paperless] Creating new tag "${name}"`);
      return await this.createTag(name);
    } catch (error) {
      console.error(`Error creating/getting tag ${name}:`, error);
      throw error;
    }
  }

  /**
   * Get all workflows from Paperless
   */
  async getWorkflows(): Promise<Array<any>> {
    try {
      const data = await this.fetch('/api/workflows/?page_size=1000');
      return data.results || [];
    } catch (error) {
      console.error('Error fetching workflows:', error);
      return [];
    }
  }

  /**
   * Get a specific workflow by ID
   */
  async getWorkflow(workflowId: number): Promise<any> {
    try {
      const data = await this.fetch(`/api/workflows/${workflowId}/`);
      return data;
    } catch (error) {
      console.error(`Error fetching workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Update a workflow
   */
  async updateWorkflow(workflowId: number, updates: any): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflows/${workflowId}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update workflow: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error(`Error updating workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Check if webhook API keys in workflows match expected key
   * Returns list of workflows with their API key status
   */
  async checkWorkflowApiKeys(expectedApiKey: string): Promise<{
    valid: boolean;
    workflows: Array<{
      id: number;
      name: string;
      hasWebhook: boolean;
      apiKeyMatch: boolean;
      currentApiKey?: string;
    }>;
  }> {
    try {
      const workflows = await this.getWorkflows();
      const paiperlessWorkflows = workflows.filter((w: any) =>
        w.name?.includes('paiperless') || w.name?.includes('pAIperless')
      );

      const results = paiperlessWorkflows.map((workflow: any) => {
        // Check if workflow has HTTP actions
        // Type can be either integer (4 = WEBHOOK) or string ('webhook', 'http')
        const actions = workflow.actions || [];
        const webhookAction = actions.find((action: any) =>
          action.type === 4 || action.type === 'webhook' || action.type === 'http'
        );

        if (!webhookAction) {
          return {
            id: workflow.id,
            name: workflow.name,
            hasWebhook: false,
            apiKeyMatch: false,
          };
        }

        // Check headers for x-api-key
        // Headers can be in action.headers or action.webhook.headers depending on Paperless version
        const headers = webhookAction.webhook?.headers || webhookAction.headers || {};
        const currentApiKey = headers['x-api-key'] || headers['X-Api-Key'] || headers['X-API-KEY'];

        return {
          id: workflow.id,
          name: workflow.name,
          hasWebhook: true,
          apiKeyMatch: currentApiKey === expectedApiKey,
          currentApiKey: currentApiKey,
        };
      });

      const allValid = results.every((r: any) => !r.hasWebhook || r.apiKeyMatch);

      return {
        valid: allValid,
        workflows: results,
      };
    } catch (error) {
      console.error('Error checking workflow API keys:', error);
      throw error;
    }
  }

  /**
   * Update webhook API key in a specific workflow
   */
  async updateWorkflowApiKey(workflowId: number, newApiKey: string): Promise<void> {
    try {
      const workflow = await this.getWorkflow(workflowId);

      // Update all webhook actions with new API key
      // Type can be either integer (4 = WEBHOOK) or string ('webhook', 'http')
      const updatedActions = (workflow.actions || []).map((action: any) => {
        if (action.type === 4 || action.type === 'webhook' || action.type === 'http') {
          // Headers can be in action.headers or action.webhook.headers depending on Paperless version
          if (action.webhook) {
            return {
              ...action,
              webhook: {
                ...action.webhook,
                headers: {
                  ...(action.webhook.headers || {}),
                  'x-api-key': newApiKey,
                },
              },
            };
          } else {
            return {
              ...action,
              headers: {
                ...(action.headers || {}),
                'x-api-key': newApiKey,
              },
            };
          }
        }
        return action;
      });

      await this.updateWorkflow(workflowId, {
        actions: updatedActions,
      });
    } catch (error) {
      console.error(`Error updating API key in workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Update webhook API key in all pAIperless workflows
   */
  async updateAllWorkflowApiKeys(newApiKey: string): Promise<{
    success: boolean;
    updated: number;
    failed: Array<{ id: number; name: string; error: string }>;
  }> {
    try {
      const check = await this.checkWorkflowApiKeys(newApiKey);
      const workflowsToUpdate = check.workflows.filter(w => w.hasWebhook && !w.apiKeyMatch);

      const failed: Array<{ id: number; name: string; error: string }> = [];
      let updated = 0;

      for (const workflow of workflowsToUpdate) {
        try {
          await this.updateWorkflowApiKey(workflow.id, newApiKey);
          updated++;
        } catch (error: any) {
          failed.push({
            id: workflow.id,
            name: workflow.name,
            error: error.message,
          });
        }
      }

      return {
        success: failed.length === 0,
        updated,
        failed,
      };
    } catch (error) {
      console.error('Error updating all workflow API keys:', error);
      throw error;
    }
  }

  /**
   * Create pAIperless webhooks automatically
   * Creates two workflows: document_added and document_updated
   */
  async createPaiperlessWorkflows(webhookApiKey: string, paiperlessUrl: string): Promise<{
    success: boolean;
    created: Array<{ name: string; id: number }>;
    existing: Array<{ name: string; id: number }>;
    failed: Array<{ name: string; error: string }>;
  }> {
    const created: Array<{ name: string; id: number }> = [];
    const existing: Array<{ name: string; id: number }> = [];
    const failed: Array<{ name: string; error: string }> = [];

    const workflows = [
      {
        name: 'paiperless_document_added',
        triggerType: 2, // DOCUMENT_ADDED
        actionType: 4,  // WEBHOOK
        url: `${paiperlessUrl}/api/webhooks/paperless/document-added`,
        description: 'Triggers AI analysis when a new document is added',
      },
      {
        name: 'paiperless_document_updated',
        triggerType: 3, // DOCUMENT_UPDATED
        actionType: 4,  // WEBHOOK
        url: `${paiperlessUrl}/api/webhooks/paperless/document-updated`,
        description: 'Triggers action processing when a document is updated',
      },
    ];

    for (const workflow of workflows) {
      try {
        // Check if workflow already exists
        const existingWorkflows = await this.getWorkflows();
        const existingWorkflow = existingWorkflows.find((w: any) => w.name === workflow.name);

        if (existingWorkflow) {
          // Workflow exists, update the API key if needed
          const actions = existingWorkflow.actions || [];
          const webhookAction = actions.find((a: any) =>
            a.type === 4 || a.type === 'webhook' || a.type === 'http'
          );

          if (webhookAction) {
            // Check current API key (can be in webhook.headers or headers)
            const currentApiKey = webhookAction.webhook?.headers?.['x-api-key'] ||
                                  webhookAction.headers?.['x-api-key'];
            if (currentApiKey !== webhookApiKey) {
              // Update API key
              await this.updateWorkflowApiKey(existingWorkflow.id, webhookApiKey);
              existing.push({ name: workflow.name, id: existingWorkflow.id });
            } else {
              existing.push({ name: workflow.name, id: existingWorkflow.id });
            }
          } else {
            existing.push({ name: workflow.name, id: existingWorkflow.id });
          }
          continue;
        }

        // Create new workflow
        const response = await fetch(`${this.baseUrl}/api/workflows/`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: workflow.name,
            enabled: true,
            order: 0,
            triggers: [
              {
                type: workflow.triggerType, // Integer: 2 for DOCUMENT_ADDED, 3 for DOCUMENT_UPDATED
                sources: [],
                filter_filename: null,
                filter_path: null,
                filter_mailrule: null,
                filter_has_tags: [],
                filter_has_document_type: null,
                filter_has_correspondent: null,
                matching_algorithm: 0, // NONE
              },
            ],
            actions: [
              {
                type: workflow.actionType, // Integer: 4 for WEBHOOK
                webhook: {
                  url: workflow.url,
                  use_params: false,
                  as_json: true,
                  params: {},
                  body: '',
                  headers: {
                    'x-api-key': webhookApiKey,
                    'Content-Type': 'application/json',
                  },
                  include_document: false,
                },
              },
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to create workflow: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        created.push({ name: workflow.name, id: data.id });
      } catch (error: any) {
        console.error(`Error creating workflow ${workflow.name}:`, error);
        failed.push({
          name: workflow.name,
          error: error.message,
        });
      }
    }

    return {
      success: failed.length === 0,
      created,
      existing,
      failed,
    };
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
