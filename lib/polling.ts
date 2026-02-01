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
      await logger.info(``);
      await logger.info(`🤖 ========================================`);
      await logger.info(`🤖 AI TAGGING PROCESS STARTED`);
      await logger.info(`🤖 ========================================`);
      await logger.info(`   → Time: ${new Date().toISOString()}`);
      await logger.info(`🤖 ========================================`);
      await logger.info(``);

    // Get Paperless client
    await logger.info(`🔌 Connecting to Paperless-NGX...`);
    const paperlessClient = await getPaperlessClient();
    await logger.info(`✅ Connected to Paperless`);
    await logger.info(``);

    // Get the AI_TODO tag ID
    const tagAiTodoName = await getConfig(CONFIG_KEYS.TAG_AI_TODO) || 'ai_todo';
    await logger.info(`🔍 Looking for AI_TODO tag: "${tagAiTodoName}"...`);
    const tagAiTodoId = await paperlessClient.getTagId(tagAiTodoName);

    if (!tagAiTodoId) {
      await logger.error(`❌ AI_TODO tag "${tagAiTodoName}" not found in Paperless`);
      await logger.error(`   → Please create this tag in Paperless configuration`);
      await logger.info(``);
      return { total: 0, successful: 0, failed: 0, results: [] };
    }

    await logger.info(`✅ AI_TODO tag found: "${tagAiTodoName}" (ID: ${tagAiTodoId})`);
    await logger.info(``);

    // Query Paperless for documents with AI_TODO tag
    await logger.info(`🔍 Querying Paperless for documents with tag "${tagAiTodoName}"...`);
    const documents = await paperlessClient.getDocumentsByTag(tagAiTodoId);
    await logger.info(`✅ Found ${documents.length} document(s) with tag "${tagAiTodoName}"`);

    if (documents.length === 0) {
      await logger.info(`ℹ️  No documents to process`);
      await logger.info(``);
      return { total: 0, successful: 0, failed: 0, results: [] };
    }

    await logger.info(`   → Document IDs: ${documents.map(d => d.id).join(', ')}`);
    await logger.info(``);

    // Update progress: starting
    await updateLockProgress('AI_DOCUMENT_PROCESSING', {
      current: 0,
      total: documents.length,
      message: `Starte Verarbeitung von ${documents.length} Dokument(en)`,
    });

    // Get Gemini client
    await logger.info(`🧠 Initializing Gemini AI client...`);
    const geminiClient = await getGeminiClient();
    await logger.info(`✅ Gemini client initialized`);
    await logger.info(``);

    // Get other configuration
    await logger.info(`⚙️  Loading configuration...`);
    const tagActionRequiredName = await getConfig(CONFIG_KEYS.TAG_ACTION_REQUIRED) || 'action_required';
    const fieldActionDescription = await getConfig(CONFIG_KEYS.FIELD_ACTION_DESCRIPTION) || 'action_description';
    const fieldDueDate = await getConfig(CONFIG_KEYS.FIELD_DUE_DATE) || 'due_date';
    await logger.info(`✅ Configuration loaded:`);
    await logger.info(`   → Action Required tag: ${tagActionRequiredName}`);
    await logger.info(`   → Action Description field: ${fieldActionDescription}`);
    await logger.info(`   → Due Date field: ${fieldDueDate}`);
    await logger.info(``);

    // Process each document
    const results = [];
    let currentIndex = 0;
    for (const doc of documents) {
      let prompt: string | undefined; // Define outside try block so it's available in catch
      try {
        currentIndex++;

        await logger.info(``);
        await logger.info(`📄 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        await logger.info(`📄 DOCUMENT ${currentIndex}/${documents.length}`);
        await logger.info(`📄 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        await logger.info(`   → Paperless ID: ${doc.id}`);
        await logger.info(`   → Title: "${doc.title}"`);
        await logger.info(`   → Current tags: ${JSON.stringify(doc.tags)}`);
        await logger.info(`📄 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        await logger.info(``);

        // Update progress
        await updateLockProgress('AI_DOCUMENT_PROCESSING', {
          current: currentIndex,
          total: documents.length,
          currentItem: doc.title || `Dokument ${doc.id}`,
          message: `Verarbeite ${currentIndex}/${documents.length}`,
        });

        // Get document content
        await logger.info(`📥 Fetching document content from Paperless...`);
        const content = await paperlessClient.getDocumentContent(doc.id);

        if (!content || content.trim().length === 0) {
          await logger.warn(`⚠️  Document has no content, skipping`);
          await logger.info(``);
          results.push({
            documentId: doc.id,
            status: 'skipped',
            reason: 'No content',
          });
          continue;
        }

        await logger.info(`✅ Content fetched: ${content.length} characters`);
        await logger.info(``);

        // Check if we can process with Gemini (cost limit check)
        const estimatedTokens = Math.ceil(content.length / 4); // Rough estimate
        await logger.info(`💰 Checking monthly Gemini token budget...`);
        await logger.info(`   → Estimated tokens for this document: ${estimatedTokens}`);
        const limitCheck = await canProcessWithGemini(estimatedTokens);
        if (!limitCheck.allowed) {
          await logger.error(`❌ Monthly Gemini token limit reached, stopping processing`);
          await logger.error(`   → Reason: ${limitCheck.reason}`);

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

        await logger.info(`✅ Monthly budget check passed: ${limitCheck.reason}`);
        await logger.info(``);

        // Generate prompt (schema no longer used - text-prompt is sufficient)
        await logger.info(`📝 Generating AI analysis prompt...`);
        const { prompt: generatedPrompt } = await generateAnalysisPrompt(paperlessClient, content);
        prompt = generatedPrompt; // Assign to outer scope variable for error handling
        await logger.info(`✅ Prompt generated (${prompt.length} characters)`);
        await logger.info(``);

        // Call Gemini AI with retry logic
        await logger.info(`🤖 Sending document to Gemini for analysis...`);
        await logger.info(`   → Using optimized text-prompt (no schema enforcement)`);
        await logger.info(`   → Max retries: 2`);

        let response;
        let tokensUsed;
        let retryCount = 0;
        const maxRetries = 2;
        const geminiStartTime = Date.now();

        while (retryCount <= maxRetries) {
          try {
            const attemptNum = retryCount + 1;
            await logger.info(`   → Attempt ${attemptNum}/${maxRetries + 1}...`);
            const result = await geminiClient.analyzeDocument(prompt);
            response = result.response;
            tokensUsed = result.tokensUsed;
            const geminiDuration = ((Date.now() - geminiStartTime) / 1000).toFixed(2);
            await logger.info(`✅ Gemini analysis successful`);
            await logger.info(`   → Duration: ${geminiDuration} seconds`);
            break; // Success, exit retry loop
          } catch (error: any) {
            retryCount++;
            await logger.error(`❌ Gemini request failed (attempt ${retryCount}/${maxRetries + 1})`);
            await logger.error(`   → Error: ${error.message}`);

            // Log raw response if available (for JSON parse errors)
            if (error.rawResponse) {
              await logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              await logger.error(`📄 COMPLETE RAW GEMINI RESPONSE:`);
              await logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              await logger.error(error.rawResponse); // Log COMPLETE response
              await logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              await logger.error(`Response Length: ${error.rawResponse.length} characters`);
              await logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            }

            if (error.stack) {
              const stackLines = error.stack.split('\n').slice(0, 3);
              for (const line of stackLines) {
                await logger.error(`   ${line}`);
              }
            }
            if (retryCount > maxRetries) {
              await logger.error(`🛑 Max retries reached, giving up on this document`);
              throw error; // Max retries reached, throw error
            }
            const waitSeconds = retryCount;
            await logger.info(`⏳ Retrying in ${waitSeconds} second(s)...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
          }
        }

        // Verify we got a response
        if (!response || !tokensUsed) {
          throw new Error('Gemini returned empty response or token data');
        }

        await logger.info(``);
        await logger.info(`📊 Gemini response received:`);
        await logger.info(JSON.stringify(response, null, 2));
        await logger.info(``);
        await logger.info(`🎯 Token usage:`);
        await logger.info(`   → Input tokens: ${tokensUsed.input}`);
        await logger.info(`   → Output tokens: ${tokensUsed.output}`);
        await logger.info(`   → Total tokens: ${tokensUsed.input + tokensUsed.output}`);
        await logger.info(``);

        // Process the response and update Paperless
        await logger.info(`🔄 Processing Gemini response and preparing Paperless update...`);
        const updates: any = {};

        // Title
        if (response.title) {
          updates.title = response.title;
          await logger.info(`   → New title: "${response.title}"`);
        }

        // Tags - convert tag names to IDs, create new tags if needed
        if (response.tags && Array.isArray(response.tags)) {
          await logger.info(`   → Gemini suggested tags: ${JSON.stringify(response.tags)}`);

          // Filter out AI_TODO tag from Gemini suggestions (it should never suggest this tag)
          const filteredTags = response.tags.filter((tagName: string) => tagName.toLowerCase() !== tagAiTodoName.toLowerCase());
          if (filteredTags.length !== response.tags.length) {
            await logger.warn(`   → Warning: Gemini incorrectly suggested "${tagAiTodoName}" tag, filtering it out`);
          }

          await logger.info(`   → Processing ${filteredTags.length} tag(s)...`);
          const tagIds: number[] = [];
          for (const tagName of filteredTags) {
            const tagId = await paperlessClient.createOrGetTag(tagName);
            await logger.info(`     • Tag "${tagName}" → ID ${tagId}`);
            tagIds.push(tagId);
          }

          // Add existing tags from document (except AI_TODO)
          const existingTags = doc.tags || [];
          await logger.info(`   → Preserving existing tags (except AI_TODO): ${JSON.stringify(existingTags)}`);

          for (const existingTagId of existingTags) {
            if (existingTagId !== tagAiTodoId && !tagIds.includes(existingTagId)) {
              tagIds.push(existingTagId);
              await logger.info(`     • Kept existing tag ID: ${existingTagId}`);
            }
          }

          // Add ACTION_REQUIRED tag if action description is present
          if (response.custom_fields && response.custom_fields[fieldActionDescription]) {
            await logger.info(`   → Action detected: Adding ACTION_REQUIRED tag`);
            const actionRequiredTagId = await paperlessClient.createOrGetTag(tagActionRequiredName);
            await logger.info(`     • ACTION_REQUIRED tag ID: ${actionRequiredTagId}`);
            if (!tagIds.includes(actionRequiredTagId)) {
              tagIds.push(actionRequiredTagId);
            }
          }

          // Add pAIperless processed tag if configured
          const tagPaiperlessProcessedName = await getConfig(CONFIG_KEYS.TAG_PAIPERLESS_PROCESSED);
          if (tagPaiperlessProcessedName) {
            await logger.info(`   → Adding pAIperless processed tag: "${tagPaiperlessProcessedName}"`);
            const paiperlessProcessedTagId = await paperlessClient.createOrGetTag(tagPaiperlessProcessedName);
            await logger.info(`     • pAIperless processed tag ID: ${paiperlessProcessedTagId}`);
            if (!tagIds.includes(paiperlessProcessedTagId)) {
              tagIds.push(paiperlessProcessedTagId);
            }
          }

          updates.tags = tagIds;
          await logger.info(`   → Final tag IDs: ${JSON.stringify(tagIds)}`);
        } else {
          // Keep existing tags but remove AI_TODO
          const existingTags = doc.tags || [];
          await logger.info(`   → No tags from Gemini, keeping existing tags except AI_TODO`);
          const tagIds = existingTags.filter((id: number) => id !== tagAiTodoId);

          // Add pAIperless processed tag if configured
          const tagPaiperlessProcessedName = await getConfig(CONFIG_KEYS.TAG_PAIPERLESS_PROCESSED);
          if (tagPaiperlessProcessedName) {
            await logger.info(`   → Adding pAIperless processed tag: "${tagPaiperlessProcessedName}"`);
            const paiperlessProcessedTagId = await paperlessClient.createOrGetTag(tagPaiperlessProcessedName);
            await logger.info(`     • pAIperless processed tag ID: ${paiperlessProcessedTagId}`);
            if (!tagIds.includes(paiperlessProcessedTagId)) {
              tagIds.push(paiperlessProcessedTagId);
            }
          }

          updates.tags = tagIds;
          await logger.info(`   → Final tag IDs: ${JSON.stringify(updates.tags)}`);
        }

        // Correspondent
        if (response.correspondent) {
          await logger.info(`   → Setting correspondent: "${response.correspondent}"`);
          const correspondentId = await paperlessClient.createOrGetCorrespondent(response.correspondent);
          updates.correspondent = correspondentId;
          await logger.info(`     • Correspondent ID: ${correspondentId}`);
        }

        // Document Type
        if (response.document_type) {
          await logger.info(`   → Setting document type: "${response.document_type}"`);
          const docTypeId = await paperlessClient.createOrGetDocumentType(response.document_type);
          updates.document_type = docTypeId;
          await logger.info(`     • Document type ID: ${docTypeId}`);
        }

        // Storage Path
        if (response.storage_path) {
          await logger.info(`   → Setting storage path: "${response.storage_path}"`);
          const storagePathId = await paperlessClient.createOrGetStoragePath(response.storage_path);
          updates.storage_path = storagePathId;
          await logger.info(`     • Storage path ID: ${storagePathId}`);
        }

        // Created Date (Ausstellungsdatum)
        if (response.created_date) {
          await logger.info(`   → Setting document date: "${response.created_date}"`);
          updates.created = response.created_date;
          await logger.info(`     • Document date: ${response.created_date}`);
        }

        // Notes (Summary)
        if (response.notes) {
          await logger.info(`   → Setting notes/summary`);
          updates.notes = response.notes;
          await logger.info(`     • Notes length: ${response.notes.length} characters`);
        }

        // Custom Fields
        if (response.custom_fields && Object.keys(response.custom_fields).length > 0) {
          await logger.info(`   → Processing ${Object.keys(response.custom_fields).length} custom field(s)...`);
          const customFields = await paperlessClient.getCustomFields();
          const customFieldUpdates: Array<{ field: number; value: any }> = [];

          for (const [fieldName, fieldValue] of Object.entries(response.custom_fields)) {
            const field = customFields.find(f => f.name === fieldName);
            if (field) {
              customFieldUpdates.push({
                field: field.id,
                value: fieldValue,
              });
              await logger.info(`     • Field "${fieldName}" (ID ${field.id}): ${JSON.stringify(fieldValue)}`);
            } else {
              await logger.warn(`     • Warning: Custom field "${fieldName}" not found in Paperless`);
            }
          }

          if (customFieldUpdates.length > 0) {
            updates.custom_fields = customFieldUpdates;
          }
        }

        await logger.info(``);
        await logger.info(`📤 Updating document in Paperless...`);
        await logger.info(`   → Update payload:`);
        await logger.info(JSON.stringify(updates, null, 2));

        try {
          const updateStartTime = Date.now();
          await paperlessClient.updateDocument(doc.id, updates);
          const updateDuration = ((Date.now() - updateStartTime) / 1000).toFixed(2);
          await logger.info(`✅ Document updated successfully in Paperless`);
          await logger.info(`   → Update duration: ${updateDuration} seconds`);

          // Verify tags were updated by fetching the document again
          await logger.info(`   → Verifying update...`);
          const updatedDoc = await paperlessClient.getDocument(doc.id);
          await logger.info(`   → Verified tags: ${JSON.stringify(updatedDoc.tags)}`);
          await logger.info(``);
        } catch (updateError: any) {
          await logger.error(`❌ Failed to update document in Paperless:`);
          await logger.error(`   → Error: ${updateError.message}`);
          if (updateError.stack) {
            const stackLines = updateError.stack.split('\n').slice(0, 3);
            for (const line of stackLines) {
              await logger.error(`   ${line}`);
            }
          }
          await logger.info(``);
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

        // Prepare prompt/response data for storage
        // Store sanitized prompt (remove document content to save space)
        let promptTemplate = prompt;
        const docContentMarker = '**Document to analyze:**';
        if (prompt.includes(docContentMarker)) {
          const parts = prompt.split(docContentMarker);
          promptTemplate = parts[0].trim() + '\n\n' + docContentMarker + '\n[Dokument-Inhalt entfernt]';
        }

        // Prepare processing details with AI analysis data
        const aiProcessingDetails = {
          aiAnalysis: {
            promptTemplate,
            geminiResponse: response,
            tokensInput: tokensUsed.input,
            tokensOutput: tokensUsed.output,
            timestamp: new Date().toISOString(),
          }
        };

        if (existingDoc) {
          // Update existing document - merge with existing processingDetails
          let mergedDetails = aiProcessingDetails;
          if (existingDoc.processingDetails) {
            try {
              const existing = JSON.parse(existingDoc.processingDetails);
              mergedDetails = { ...existing, ...aiProcessingDetails };
            } catch (e) {
              await logger.warn(`Failed to parse existing processingDetails, overwriting`);
            }
          }

          await prisma.document.updateMany({
            where: { paperlessId: doc.id },
            data: {
              geminiTokensSent: tokensUsed.input,
              geminiTokensRecv: tokensUsed.output,
              processingDetails: JSON.stringify(mergedDetails),
            },
          });
          await logger.info(`✅ Stored prompt and response in database`);
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
              processingDetails: JSON.stringify(aiProcessingDetails),
            },
          });
          await logger.info(`✅ Stored prompt and response in database`);
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

        await logger.info(`✅ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        await logger.info(`✅ DOCUMENT PROCESSING COMPLETE`);
        await logger.info(`✅ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        await logger.info(`   → Paperless ID: ${doc.id}`);
        await logger.info(`   → Title: "${doc.title}"`);
        await logger.info(`   → Tokens used: ${tokensUsed.input + tokensUsed.output}`);
        await logger.info(`   → Status: SUCCESS`);
        await logger.info(`✅ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        await logger.info(``);

        // Send email notification for successful processing
        await sendDocumentProcessedEmail(
          doc.title || `Dokument ${doc.id}`,
          doc.id,
          tokensUsed.input + tokensUsed.output
        );
      } catch (error: any) {
        await logger.error(`❌ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        await logger.error(`❌ DOCUMENT PROCESSING ERROR`);
        await logger.error(`❌ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        await logger.error(`   → Paperless ID: ${doc.id}`);
        await logger.error(`   → Title: "${doc.title}"`);
        await logger.error(`   → Error: ${error.message}`);
        await logger.error(`   → Type: ${error.constructor.name}`);
        await logger.error(``);
        if (error.stack) {
          await logger.error(`Stack trace:`);
          const stackLines = error.stack.split('\n').slice(0, 10);
          for (const line of stackLines) {
            await logger.error(`   ${line}`);
          }
        }
        await logger.error(`❌ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        await logger.error(``);

        // Update document status to ERROR in database
        const dbDoc = await prisma.document.findFirst({
          where: { paperlessId: doc.id }
        });

        if (dbDoc) {
          await prisma.document.update({
            where: { id: dbDoc.id },
            data: {
              status: 'ERROR',
              errorMessage: error.message || 'Unknown error during AI analysis'
            }
          });
          await logger.info(`💾 Updated document ${dbDoc.id} status to ERROR`);
        } else {
          // Document not in database (uploaded via Paperless UI directly), create entry
          await logger.warn(`⚠️  Document ${doc.id} not in pAIperless database, creating ERROR entry...`);
          try {
            const newDoc = await prisma.document.create({
              data: {
                paperlessId: doc.id,
                originalFilename: doc.title || `document-${doc.id}`,
                fileHash: `paperless-${doc.id}-error-${Date.now()}`, // Unique hash for Paperless-uploaded docs
                status: 'ERROR',
                errorMessage: error.message || 'Unknown error during AI analysis',
              },
            });
            await logger.info(`💾 Created new ERROR document entry: ID ${newDoc.id}`);
          } catch (createError: any) {
            await logger.error(`❌ Failed to create ERROR document entry:`, createError);
          }
        }

        // Send email notification for error
        await sendDocumentErrorEmail(
          doc.title || `Dokument ${doc.id}`,
          error.message || 'Unknown error',
          doc.id
        );

        // Log with prompt and response for debugging
        const logMeta: any = {
          documentId: doc.id,
          paperlessId: doc.id,
          error: error.message,
          stack: error.stack,
        };

        // Include raw response if available (for JSON parse errors)
        if (error.rawResponse) {
          logMeta.geminiRawResponse = error.rawResponse; // Store COMPLETE response in database
          await logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          await logger.error(`📄 COMPLETE RAW GEMINI RESPONSE:`);
          await logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          await logger.error(error.rawResponse); // Log COMPLETE response without truncation
          await logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          await logger.error(`Response Length: ${error.rawResponse.length} characters`);
          await logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        }

        // Include prompt if we generated it
        if (prompt) {
          // Remove document content from prompt for logging
          const promptParts = prompt.split('**Document to analyze:**');
          if (promptParts.length > 0) {
            logMeta.promptTemplate = promptParts[0].trim() + '\n\n**Document to analyze:**\n[Content removed for logging]';
          }
        }

        await prisma.log.create({
          data: {
            level: 'ERROR',
            message: `Failed to analyze document ${doc.id}: ${error.message}`,
            meta: JSON.stringify(logMeta),
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
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    const totalTokens = results
      .filter(r => r.status === 'success')
      .reduce((sum, r) => sum + (r.tokensUsed || 0), 0);

    await logger.info(`🎉 ========================================`);
    await logger.info(`🎉 AI TAGGING PROCESS COMPLETE`);
    await logger.info(`🎉 ========================================`);
    await logger.info(`   → Total documents: ${documents.length}`);
    await logger.info(`   → Successful: ${successCount}`);
    await logger.info(`   → Failed: ${failedCount}`);
    await logger.info(`   → Skipped: ${skippedCount}`);
    await logger.info(`   → Total tokens used: ${totalTokens}`);
    await logger.info(`   → Time: ${new Date().toISOString()}`);
    await logger.info(`🎉 ========================================`);
    await logger.info(``);

      return {
        total: documents.length,
        successful: successCount,
        failed: failedCount,
        results,
      };
    } catch (error: any) {
      await logger.error(`❌ ========================================`);
      await logger.error(`❌ AI TAGGING PROCESS ERROR`);
      await logger.error(`❌ ========================================`);
      await logger.error(`   → Error: ${error.message}`);
      await logger.error(`   → Type: ${error.constructor.name}`);
      if (error.stack) {
        await logger.error(``);
        await logger.error(`Stack trace:`);
        const stackLines = error.stack.split('\n').slice(0, 10);
        for (const line of stackLines) {
          await logger.error(`   ${line}`);
        }
      }
      await logger.error(`❌ ========================================`);
      await logger.error(``);
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
    await logger.info(`ℹ️  AI_TODO polling is disabled in configuration`);
    return;
  }

  // Get polling interval (in minutes)
  const intervalMinutes = parseInt(await getConfig(CONFIG_KEYS.POLL_AI_TODO_INTERVAL) || '30');
  const intervalMs = intervalMinutes * 60 * 1000;

  await logger.info(``);
  await logger.info(`🔄 ========================================`);
  await logger.info(`🔄 STARTING AI_TODO POLLING`);
  await logger.info(`🔄 ========================================`);
  await logger.info(`   → Interval: ${intervalMinutes} minutes`);
  await logger.info(`   → Interval (ms): ${intervalMs}`);
  await logger.info(`🔄 ========================================`);
  await logger.info(``);

  // Run immediately on startup (will check emergency stop internally)
  await logger.info(`▶️  Running initial AI_TODO check...`);
  await processAiTodoDocuments();

  // Schedule recurring polling (each iteration will check emergency stop)
  pollInterval = setInterval(async () => {
    await logger.info(`⏰ Scheduled AI_TODO polling triggered (interval: ${intervalMinutes} minutes)`);
    await processAiTodoDocuments();
  }, intervalMs);

  await logger.info(`✅ AI_TODO polling started and scheduled`);
  await logger.info(``);
}

/**
 * Stop polling
 */
export async function stopAiTodoPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    await logger.info(``);
    await logger.info(`🛑 ========================================`);
    await logger.info(`🛑 AI_TODO POLLING STOPPED`);
    await logger.info(`🛑 ========================================`);
    await logger.info(`   → Time: ${new Date().toISOString()}`);
    await logger.info(`🛑 ========================================`);
    await logger.info(``);
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
