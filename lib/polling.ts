import { getConfig, CONFIG_KEYS } from './config';
import { getPaperlessClient } from './paperless';
import { getGeminiClient } from './gemini';
import { generateAnalysisPrompt } from './prompt-generator';
import { prisma } from './prisma';
import { createLogger } from './logger';

const logger = createLogger('Polling');

let pollInterval: NodeJS.Timeout | null = null;

/**
 * Process documents with AI_TODO tag
 * This is the core logic used by both webhooks and polling
 */
export async function processAiTodoDocuments(): Promise<{
  total: number;
  successful: number;
  failed: number;
  results: Array<any>;
}> {
  try {
    await logger.info('[AI Polling] Starting AI_TODO document processing');

    // Get Paperless client
    const paperlessClient = await getPaperlessClient();

    // Get the AI_TODO tag ID
    const tagAiTodoName = await getConfig(CONFIG_KEYS.TAG_AI_TODO) || 'ai_todo';
    const tagAiTodoId = await paperlessClient.getTagId(tagAiTodoName);

    if (!tagAiTodoId) {
      await logger.error(`[AI Polling] AI_TODO tag "${tagAiTodoName}" not found in Paperless`);
      return { total: 0, successful: 0, failed: 0, results: [] };
    }

    // Query Paperless for documents with AI_TODO tag
    const documents = await paperlessClient.getDocumentsByTag(tagAiTodoId);
    await logger.info(`[AI Polling] Found ${documents.length} documents with tag "${tagAiTodoName}"`);

    if (documents.length === 0) {
      return { total: 0, successful: 0, failed: 0, results: [] };
    }

    // Get Gemini client
    const geminiClient = await getGeminiClient();

    // Get other configuration
    const tagActionRequiredName = await getConfig(CONFIG_KEYS.TAG_ACTION_REQUIRED) || 'action_required';
    const fieldActionDescription = await getConfig(CONFIG_KEYS.FIELD_ACTION_DESCRIPTION) || 'action_description';
    const fieldDueDate = await getConfig(CONFIG_KEYS.FIELD_DUE_DATE) || 'due_date';

    // Process each document
    const results = [];
    for (const doc of documents) {
      try {
        await logger.info(`[AI Polling] Processing document ${doc.id}: "${doc.title}"`);

        // Get document content
        const content = await paperlessClient.getDocumentContent(doc.id);

        if (!content || content.trim().length === 0) {
          await logger.warn(`[AI Polling] Document ${doc.id} has no content, skipping`);
          results.push({
            documentId: doc.id,
            status: 'skipped',
            reason: 'No content',
          });
          continue;
        }

        // Generate prompt
        const prompt = await generateAnalysisPrompt(paperlessClient, content);

        // Call Gemini AI
        await logger.info(`[AI Polling] Sending document ${doc.id} to Gemini for analysis`);
        const { response, tokensUsed } = await geminiClient.analyzeDocument(prompt);

        await logger.info(`[AI Polling] Gemini response for document ${doc.id}:`, JSON.stringify(response, null, 2));
        await logger.info(`[AI Polling] Tokens used - Input: ${tokensUsed.input}, Output: ${tokensUsed.output}`);

        // Process the response and update Paperless
        const updates: any = {};

        // Title
        if (response.title) {
          updates.title = response.title;
        }

        // Tags - convert tag names to IDs, create new tags if needed
        if (response.tags && Array.isArray(response.tags)) {
          const tagIds: number[] = [];
          for (const tagName of response.tags) {
            const tagId = await paperlessClient.createOrGetTag(tagName);
            tagIds.push(tagId);
          }

          // Add existing tags from document (except AI_TODO)
          const existingTags = doc.tags || [];
          for (const existingTagId of existingTags) {
            if (existingTagId !== tagAiTodoId && !tagIds.includes(existingTagId)) {
              tagIds.push(existingTagId);
            }
          }

          // Add ACTION_REQUIRED tag if action description is present
          if (response.custom_fields && response.custom_fields[fieldActionDescription]) {
            const actionRequiredTagId = await paperlessClient.createOrGetTag(tagActionRequiredName);
            if (!tagIds.includes(actionRequiredTagId)) {
              tagIds.push(actionRequiredTagId);
            }
          }

          updates.tags = tagIds;
        } else {
          // Keep existing tags but remove AI_TODO
          const existingTags = doc.tags || [];
          updates.tags = existingTags.filter((id: number) => id !== tagAiTodoId);
        }

        // Correspondent
        if (response.correspondent) {
          const correspondentId = await paperlessClient.createOrGetCorrespondent(response.correspondent);
          updates.correspondent = correspondentId;
        }

        // Document Type
        if (response.document_type) {
          const docTypeId = await paperlessClient.createOrGetDocumentType(response.document_type);
          updates.document_type = docTypeId;
        }

        // Storage Path
        if (response.storage_path) {
          const storagePathId = await paperlessClient.createOrGetStoragePath(response.storage_path);
          updates.storage_path = storagePathId;
        }

        // Custom Fields
        if (response.custom_fields && Object.keys(response.custom_fields).length > 0) {
          const customFields = await paperlessClient.getCustomFields();
          const customFieldUpdates: Array<{ field: number; value: any }> = [];

          for (const [fieldName, fieldValue] of Object.entries(response.custom_fields)) {
            const field = customFields.find(f => f.name === fieldName);
            if (field) {
              customFieldUpdates.push({
                field: field.id,
                value: fieldValue,
              });
            }
          }

          if (customFieldUpdates.length > 0) {
            updates.custom_fields = customFieldUpdates;
          }
        }

        // Update document in Paperless
        await logger.info(`[AI Polling] Updating document ${doc.id} in Paperless with:`, JSON.stringify(updates, null, 2));
        await paperlessClient.updateDocument(doc.id, updates);

        // Track token usage in database
        await prisma.log.create({
          data: {
            level: 'INFO',
            message: `Document ${doc.id} analyzed`,
            meta: JSON.stringify({
              documentId: doc.id,
              tokensInput: tokensUsed.input,
              tokensOutput: tokensUsed.output,
              tokensTotal: tokensUsed.input + tokensUsed.output,
            }),
          },
        });

        results.push({
          documentId: doc.id,
          status: 'success',
          tokensUsed: tokensUsed.input + tokensUsed.output,
        });

        await logger.info(`[AI Polling] Successfully processed document ${doc.id}`);
      } catch (error: any) {
        await logger.error(`[AI Polling] Error processing document ${doc.id}:`, error);

        await prisma.log.create({
          data: {
            level: 'ERROR',
            message: `Failed to analyze document ${doc.id}`,
            meta: JSON.stringify({
              documentId: doc.id,
              error: error.message,
              stack: error.stack,
            }),
          },
        });

        results.push({
          documentId: doc.id,
          status: 'error',
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'error').length;

    await logger.info(`[AI Polling] Completed processing ${documents.length} documents. Success: ${successCount}, Errors: ${failedCount}`);

    return {
      total: documents.length,
      successful: successCount,
      failed: failedCount,
      results,
    };
  } catch (error: any) {
    await logger.error('[AI Polling] Unexpected error:', error);
    return { total: 0, successful: 0, failed: 0, results: [] };
  }
}

/**
 * Start polling for AI_TODO documents
 */
export async function startAiTodoPolling() {
  // Check if polling is enabled
  const pollEnabled = await getConfig(CONFIG_KEYS.POLL_AI_TODO_ENABLED) === 'true';

  if (!pollEnabled) {
    await logger.info('[AI Polling] Polling is disabled');
    return;
  }

  // Get polling interval (in minutes)
  const intervalMinutes = parseInt(await getConfig(CONFIG_KEYS.POLL_AI_TODO_INTERVAL) || '30');
  const intervalMs = intervalMinutes * 60 * 1000;

  await logger.info(`[AI Polling] Starting AI_TODO polling (interval: ${intervalMinutes} minutes)`);

  // Run immediately on startup
  await processAiTodoDocuments();

  // Schedule recurring polling
  pollInterval = setInterval(async () => {
    await processAiTodoDocuments();
  }, intervalMs);
}

/**
 * Stop polling
 */
export async function stopAiTodoPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    await logger.info('[AI Polling] Polling stopped');
  }
}

/**
 * Check if polling is currently running
 */
export function isPollingActive(): boolean {
  return pollInterval !== null;
}
