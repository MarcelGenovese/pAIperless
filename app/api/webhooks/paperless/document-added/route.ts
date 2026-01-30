import { NextRequest, NextResponse } from 'next/server';
import { getConfig, CONFIG_KEYS } from '@/lib/config';
import { getPaperlessClient } from '@/lib/paperless';
import { getGeminiClient } from '@/lib/gemini';
import { generateAnalysisPrompt } from '@/lib/prompt-generator';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * Webhook endpoint for Paperless document-added events
 * This is triggered by Paperless workflows when new documents are added
 *
 * Workflow: paiperless_document_added
 * - Trigger: Document added
 * - Action: POST to this endpoint
 * - Header: x-api-key: {WEBHOOK_API_KEY}
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Validate webhook API key
    const apiKey = request.headers.get('x-api-key');
    const expectedApiKey = await getConfig(CONFIG_KEYS.WEBHOOK_API_KEY);

    if (!apiKey || !expectedApiKey || apiKey !== expectedApiKey) {
      console.error('[Webhook] Invalid API key');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Webhook] Document added webhook triggered');

    // 2. Get Paperless client
    const paperlessClient = await getPaperlessClient();

    // 3. Get the AI_TODO tag ID
    const tagAiTodoName = await getConfig(CONFIG_KEYS.TAG_AI_TODO) || 'ai_todo';
    const tagAiTodoId = await paperlessClient.getTagId(tagAiTodoName);

    if (!tagAiTodoId) {
      console.error(`[Webhook] AI_TODO tag "${tagAiTodoName}" not found in Paperless`);
      return NextResponse.json(
        { error: 'AI_TODO tag not configured' },
        { status: 500 }
      );
    }

    // 4. Query Paperless for documents with AI_TODO tag
    const documents = await paperlessClient.getDocumentsByTag(tagAiTodoId);
    console.log(`[Webhook] Found ${documents.length} documents with tag "${tagAiTodoName}"`);

    if (documents.length === 0) {
      return NextResponse.json({
        message: 'No documents to process',
        processed: 0,
      });
    }

    // 5. Get Gemini client
    const geminiClient = await getGeminiClient();

    // 6. Get other configuration
    const tagActionRequiredName = await getConfig(CONFIG_KEYS.TAG_ACTION_REQUIRED) || 'action_required';
    const fieldActionDescription = await getConfig(CONFIG_KEYS.FIELD_ACTION_DESCRIPTION) || 'action_description';
    const fieldDueDate = await getConfig(CONFIG_KEYS.FIELD_DUE_DATE) || 'due_date';

    // 7. Process each document
    const results = [];
    for (const doc of documents) {
      try {
        console.log(`[Webhook] Processing document ${doc.id}: "${doc.title}"`);

        // Get document content
        const content = await paperlessClient.getDocumentContent(doc.id);

        if (!content || content.trim().length === 0) {
          console.warn(`[Webhook] Document ${doc.id} has no content, skipping`);
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
        console.log(`[Webhook] Sending document ${doc.id} to Gemini for analysis`);
        const { response, tokensUsed } = await geminiClient.analyzeDocument(prompt);

        console.log(`[Webhook] Gemini response for document ${doc.id}:`, JSON.stringify(response, null, 2));
        console.log(`[Webhook] Tokens used - Input: ${tokensUsed.input}, Output: ${tokensUsed.output}`);

        // 8. Process the response and update Paperless
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
        console.log(`[Webhook] Updating document ${doc.id} in Paperless with:`, JSON.stringify(updates, null, 2));
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

        console.log(`[Webhook] Successfully processed document ${doc.id}`);
      } catch (error: any) {
        console.error(`[Webhook] Error processing document ${doc.id}:`, error);

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

    // 9. Return summary
    const successCount = results.filter(r => r.status === 'success').length;
    const totalTokens = results.reduce((sum, r) => sum + (r.tokensUsed || 0), 0);

    console.log(`[Webhook] Completed processing ${documents.length} documents. Success: ${successCount}, Errors: ${results.filter(r => r.status === 'error').length}`);

    return NextResponse.json({
      message: 'Documents processed',
      total: documents.length,
      successful: successCount,
      failed: results.filter(r => r.status === 'error').length,
      totalTokensUsed: totalTokens,
      results,
    });
  } catch (error: any) {
    console.error('[Webhook] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
