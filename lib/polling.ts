import { getConfig, CONFIG_KEYS } from './config';
import { getPaperlessClient } from './paperless';
import { getGeminiClient } from './gemini';
import { generateAnalysisPrompt } from './prompt-generator';
import { prisma } from './prisma';
import { createLogger } from './logger';
import { withLock, isLocked, updateLockProgress } from './process-lock';
import { checkEmergencyStop } from './emergency-stop';
import { canProcessWithGemini } from './cost-tracking';
import { sendDocumentProcessedEmail, sendDocumentErrorEmail } from './email';

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
  // Check emergency stop first
  try {
    await checkEmergencyStop('AI document processing');
  } catch (error) {
    await logger.warn('[AI Polling] Blocked by emergency stop');
    return { total: 0, successful: 0, failed: 0, results: [] };
  }

  // Check if already processing
  if (await isLocked('AI_DOCUMENT_PROCESSING')) {
    await logger.warn('[AI Polling] AI processing already running, skipping');
    return { total: 0, successful: 0, failed: 0, results: [] };
  }

  // Use lock to prevent concurrent processing
  return withLock('AI_DOCUMENT_PROCESSING', 'Processing AI_TODO documents', async () => {
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

    await logger.info(`[AI Polling] AI_TODO tag "${tagAiTodoName}" has ID: ${tagAiTodoId}`);

    // Query Paperless for documents with AI_TODO tag
    const documents = await paperlessClient.getDocumentsByTag(tagAiTodoId);
    await logger.info(`[AI Polling] Found ${documents.length} documents with tag "${tagAiTodoName}"`);

    if (documents.length === 0) {
      return { total: 0, successful: 0, failed: 0, results: [] };
    }

    // Update progress: starting
    await updateLockProgress('AI_DOCUMENT_PROCESSING', {
      current: 0,
      total: documents.length,
      message: `Starte Verarbeitung von ${documents.length} Dokument(en)`,
    });

    // Get Gemini client
    const geminiClient = await getGeminiClient();

    // Get other configuration
    const tagActionRequiredName = await getConfig(CONFIG_KEYS.TAG_ACTION_REQUIRED) || 'action_required';
    const fieldActionDescription = await getConfig(CONFIG_KEYS.FIELD_ACTION_DESCRIPTION) || 'action_description';
    const fieldDueDate = await getConfig(CONFIG_KEYS.FIELD_DUE_DATE) || 'due_date';

    // Process each document
    const results = [];
    let currentIndex = 0;
    for (const doc of documents) {
      try {
        currentIndex++;
        await logger.info(`[AI Polling] Processing document ${doc.id}: "${doc.title}"`);
        await logger.info(`[AI Polling] Document ${doc.id} current tags: ${JSON.stringify(doc.tags)}`);

        // Update progress
        await updateLockProgress('AI_DOCUMENT_PROCESSING', {
          current: currentIndex,
          total: documents.length,
          currentItem: doc.title || `Dokument ${doc.id}`,
          message: `Verarbeite ${currentIndex}/${documents.length}`,
        });

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

        // Check if we can process with Gemini (cost limit check)
        const estimatedTokens = Math.ceil(content.length / 4); // Rough estimate
        const limitCheck = await canProcessWithGemini(estimatedTokens);
        if (!limitCheck.allowed) {
          await logger.error(`[AI Polling] Monthly Gemini token limit reached, stopping processing`);
          await logger.error(`[AI Polling] ${limitCheck.reason}`);

          // Update document status to show limit reached
          await prisma.log.create({
            data: {
              level: 'ERROR',
              message: `Document ${doc.id} skipped - Token limit reached`,
              meta: JSON.stringify({
                documentId: doc.id,
                reason: limitCheck.reason,
              }),
            },
          });

          results.push({
            documentId: doc.id,
            status: 'skipped',
            reason: 'Token limit reached',
          });

          // Stop processing further documents
          break;
        }

        // Generate prompt and schema
        const { prompt, schema } = await generateAnalysisPrompt(paperlessClient, content);

        // Call Gemini AI with retry logic
        await logger.info(`[AI Polling] Sending document ${doc.id} to Gemini for analysis (with JSON schema validation)`);

        let response;
        let tokensUsed;
        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount <= maxRetries) {
          try {
            const result = await geminiClient.analyzeDocument(prompt, schema);
            response = result.response;
            tokensUsed = result.tokensUsed;
            await logger.info(`[AI Polling] ✅ Gemini analysis successful for document ${doc.id}`);
            break; // Success, exit retry loop
          } catch (error: any) {
            retryCount++;
            await logger.error(`[AI Polling] ❌ Gemini request failed for document ${doc.id}, attempt ${retryCount}/${maxRetries + 1}`, {
              error: error.message,
              stack: error.stack
            });
            if (retryCount > maxRetries) {
              await logger.error(`[AI Polling] 🛑 Max retries reached for document ${doc.id}, giving up`);
              throw error; // Max retries reached, throw error
            }
            await logger.info(`[AI Polling] ⏳ Retrying in ${retryCount} second(s)...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
          }
        }

        // Verify we got a response
        if (!response || !tokensUsed) {
          throw new Error('Gemini returned empty response or token data');
        }

        await logger.info(`[AI Polling] 📄 Gemini response for document ${doc.id}:`, JSON.stringify(response, null, 2));
        await logger.info(`[AI Polling] 🎯 Tokens used - Input: ${tokensUsed.input}, Output: ${tokensUsed.output}`);

        // Process the response and update Paperless
        const updates: any = {};

        // Title
        if (response.title) {
          updates.title = response.title;
        }

        // Tags - convert tag names to IDs, create new tags if needed
        if (response.tags && Array.isArray(response.tags)) {
          await logger.info(`[AI Polling] Gemini suggested tags for document ${doc.id}: ${JSON.stringify(response.tags)}`);

          // Filter out AI_TODO tag from Gemini suggestions (it should never suggest this tag)
          const filteredTags = response.tags.filter((tagName: string) => tagName.toLowerCase() !== tagAiTodoName.toLowerCase());
          if (filteredTags.length !== response.tags.length) {
            await logger.warn(`[AI Polling] Gemini incorrectly suggested "${tagAiTodoName}" tag, filtering it out`);
          }

          const tagIds: number[] = [];
          for (const tagName of filteredTags) {
            await logger.info(`[AI Polling] Getting/creating tag: "${tagName}"`);
            const tagId = await paperlessClient.createOrGetTag(tagName);
            await logger.info(`[AI Polling] Tag "${tagName}" has ID: ${tagId}`);
            tagIds.push(tagId);
          }

          // Add existing tags from document (except AI_TODO)
          const existingTags = doc.tags || [];
          await logger.info(`[AI Polling] Document ${doc.id} existing tags before filter: ${JSON.stringify(existingTags)}`);
          await logger.info(`[AI Polling] Filtering out AI_TODO tag with ID: ${tagAiTodoId}`);

          for (const existingTagId of existingTags) {
            if (existingTagId !== tagAiTodoId && !tagIds.includes(existingTagId)) {
              tagIds.push(existingTagId);
            }
          }

          // Add ACTION_REQUIRED tag if action description is present
          if (response.custom_fields && response.custom_fields[fieldActionDescription]) {
            const actionRequiredTagId = await paperlessClient.createOrGetTag(tagActionRequiredName);
            await logger.info(`[AI Polling] Adding ACTION_REQUIRED tag (ID: ${actionRequiredTagId}) to document ${doc.id}`);
            if (!tagIds.includes(actionRequiredTagId)) {
              tagIds.push(actionRequiredTagId);
            }
          }

          updates.tags = tagIds;
          await logger.info(`[AI Polling] Final tag IDs for document ${doc.id}: ${JSON.stringify(tagIds)}`);
        } else {
          // Keep existing tags but remove AI_TODO
          const existingTags = doc.tags || [];
          await logger.info(`[AI Polling] No tags from Gemini, keeping existing tags except AI_TODO`);
          await logger.info(`[AI Polling] Document ${doc.id} existing tags before filter: ${JSON.stringify(existingTags)}`);
          updates.tags = existingTags.filter((id: number) => id !== tagAiTodoId);
          await logger.info(`[AI Polling] Final tag IDs for document ${doc.id} after removing AI_TODO: ${JSON.stringify(updates.tags)}`);
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

        try {
          await paperlessClient.updateDocument(doc.id, updates);
          await logger.info(`[AI Polling] Successfully updated document ${doc.id} in Paperless`);

          // Verify tags were updated by fetching the document again
          const updatedDoc = await paperlessClient.getDocument(doc.id);
          await logger.info(`[AI Polling] Document ${doc.id} tags after update: ${JSON.stringify(updatedDoc.tags)}`);
        } catch (updateError: any) {
          await logger.error(`[AI Polling] Failed to update document ${doc.id} in Paperless:`, updateError);
          throw updateError;
        }

        // Track token usage in database - both in logs AND document table
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

        // Update token usage in Document table AND costTracking table
        const existingDoc = await prisma.document.findFirst({
          where: { paperlessId: doc.id },
        });

        if (existingDoc) {
          // Update existing document
          await prisma.document.updateMany({
            where: { paperlessId: doc.id },
            data: {
              geminiTokensSent: tokensUsed.input,
              geminiTokensRecv: tokensUsed.output,
            },
          });
        } else {
          // Create new record for tracking
          // Check if this is a _searchable document and try to find the original
          let ocrPages = null;
          if (doc.title && doc.title.includes('_searchable')) {
            const originalTitle = doc.title.replace('_searchable', '');
            const originalDoc = await prisma.document.findFirst({
              where: {
                originalFilename: {
                  contains: originalTitle
                }
              },
              orderBy: {
                createdAt: 'desc'
              }
            });
            if (originalDoc && originalDoc.ocrPageCount) {
              ocrPages = originalDoc.ocrPageCount;
              await logger.info(`[AI Polling] Found original document for ${doc.title}, copying ocrPageCount: ${ocrPages}`);
            }
          }

          await prisma.document.create({
            data: {
              paperlessId: doc.id,
              originalFilename: doc.title || `document-${doc.id}`,
              fileHash: `paperless-${doc.id}`,
              status: 'COMPLETED',
              geminiTokensSent: tokensUsed.input,
              geminiTokensRecv: tokensUsed.output,
              ocrPageCount: ocrPages,
            },
          });
        }

        // Update costTracking table for monthly usage tracking
        const tracking = await prisma.costTracking.findFirst({
          where: {
            month: {
              startsWith: new Date().toISOString().slice(0, 7) // Current month YYYY-MM
            }
          }
        });

        if (tracking) {
          await prisma.costTracking.update({
            where: { id: tracking.id },
            data: {
              geminiTokensSent: {
                increment: tokensUsed.input
              },
              geminiTokensReceived: {
                increment: tokensUsed.output
              }
            }
          });
        } else {
          // Create tracking record if it doesn't exist
          await prisma.costTracking.create({
            data: {
              month: new Date().toISOString().slice(0, 7),
              geminiTokensSent: tokensUsed.input,
              geminiTokensReceived: tokensUsed.output,
              documentAIPagesLimit: 5000,
              geminiTokensLimit: 1000000,
            }
          });
        }

        results.push({
          documentId: doc.id,
          status: 'success',
          tokensUsed: tokensUsed.input + tokensUsed.output,
        });

        await logger.info(`[AI Polling] Successfully processed document ${doc.id}`);

        // Send email notification for successful processing
        await sendDocumentProcessedEmail(
          doc.title || `Dokument ${doc.id}`,
          doc.id,
          tokensUsed.input + tokensUsed.output
        );
      } catch (error: any) {
        await logger.error(`[AI Polling] Error processing document ${doc.id}:`, error);

        // Send email notification for error
        await sendDocumentErrorEmail(
          doc.title || `Dokument ${doc.id}`,
          error.message || 'Unknown error',
          doc.id
        );

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
  });
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

  // Run immediately on startup (will check emergency stop internally)
  await processAiTodoDocuments();

  // Schedule recurring polling (each iteration will check emergency stop)
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

/**
 * Restart polling with new settings
 * This should be called when polling settings are changed
 */
export async function restartAiTodoPolling() {
  await logger.info('[AI Polling] Restarting polling with new settings...');
  await stopAiTodoPolling();
  await startAiTodoPolling();
}
