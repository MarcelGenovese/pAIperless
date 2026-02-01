import { NextRequest, NextResponse } from 'next/server';
import { getConfig, CONFIG_KEYS } from '@/lib/config';
import { getPaperlessClient } from '@/lib/paperless';
import { createCalendarEvent, createTask, hasExistingCalendarOrTask } from '@/lib/google-calendar-tasks';
import { prisma } from '@/lib/prisma';
import { checkEmergencyStop } from '@/lib/emergency-stop';
import { createLogger } from '@/lib/logger';
import { sendActionRequiredEmail } from '@/lib/email';

export const runtime = 'nodejs';

const logger = createLogger('WebhookDocumentUpdated');

/**
 * Webhook endpoint for Paperless document-updated events
 * This is triggered by Paperless workflows when documents are updated
 *
 * Workflow: paiperless_document_updated
 * - Trigger: Document updated
 * - Action: POST to this endpoint
 * - Header: x-api-key: {WEBHOOK_API_KEY}
 *
 * Purpose: Create Google Calendar events and Tasks for documents with action_required tag
 */
export async function POST(request: NextRequest) {
  try {
    await logger.info('========================================');
    await logger.info('[Document Updated] WEBHOOK CALLED');
    await logger.info('========================================');

    // 1. Check emergency stop first
    try {
      await checkEmergencyStop('Webhook processing');
      await logger.info('[Document Updated] Emergency stop check passed');
    } catch (error) {
      await logger.warn('[Document Updated] Blocked by emergency stop');
      return NextResponse.json(
        { message: 'Processing blocked by emergency stop', processed: 0 },
        { status: 503 }
      );
    }

    // 2. Validate webhook API key
    const apiKey = request.headers.get('x-api-key');
    const expectedApiKey = await getConfig(CONFIG_KEYS.WEBHOOK_API_KEY);

    await logger.info(`[Document Updated] API key validation: ${apiKey ? 'provided' : 'missing'}, expected: ${expectedApiKey ? 'set' : 'not set'}`);

    if (!apiKey || !expectedApiKey || apiKey !== expectedApiKey) {
      await logger.error('[Document Updated] Invalid API key - REJECTING REQUEST');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await logger.info('[Document Updated] Webhook triggered - API key valid');

    // 3. Get Paperless client
    const paperlessClient = await getPaperlessClient();

    // 4. Get the ACTION_REQUIRED tag ID
    const tagActionRequiredName = await getConfig(CONFIG_KEYS.TAG_ACTION_REQUIRED) || 'action_required';
    const tagActionRequiredId = await paperlessClient.getTagId(tagActionRequiredName);

    if (!tagActionRequiredId) {
      await logger.warn(`[Document Updated] ACTION_REQUIRED tag "${tagActionRequiredName}" not found in Paperless`);
      return NextResponse.json({
        message: 'ACTION_REQUIRED tag not found',
        processed: 0,
      });
    }

    // 5. Query Paperless for documents with ACTION_REQUIRED tag
    await logger.info(`[Document Updated] Querying Paperless for documents with tag ID ${tagActionRequiredId} ("${tagActionRequiredName}")`);
    const documents = await paperlessClient.getDocumentsByTag(tagActionRequiredId);
    await logger.info(`[Document Updated] Found ${documents.length} documents with tag "${tagActionRequiredName}"`);

    if (documents.length === 0) {
      await logger.info('[Document Updated] No documents to process - exiting');
      return NextResponse.json({
        message: 'No documents with ACTION_REQUIRED tag',
        processed: 0,
      });
    }

    await logger.info(`[Document Updated] Will process ${documents.length} documents:`)
    for (const doc of documents) {
      await logger.info(`  - Document ${doc.id}: "${doc.title}"`);
    }

    // 6. Get custom field names for action description and due date
    const fieldActionDescription = await getConfig(CONFIG_KEYS.FIELD_ACTION_DESCRIPTION) || 'action_description';
    const fieldDueDate = await getConfig(CONFIG_KEYS.FIELD_DUE_DATE) || 'due_date';

    // 7. Process each document
    const results = [];
    let processed = 0;
    let skipped = 0;

    for (const doc of documents) {
      try {
        await logger.info(`[Document Updated] Processing document ${doc.id}: "${doc.title}"`);

        // Check if calendar event or task already exists
        const alreadyExists = await hasExistingCalendarOrTask(doc.id);
        if (alreadyExists) {
          await logger.info(`[Document Updated] Document ${doc.id} already has calendar event or task, skipping`);
          skipped++;
          results.push({
            documentId: doc.id,
            status: 'skipped',
            reason: 'Already has calendar event or task',
          });
          continue;
        }

        // Get custom fields
        const customFields = await paperlessClient.getCustomFields();
        const actionDescField = customFields.find(f => f.name === fieldActionDescription);
        const dueDateField = customFields.find(f => f.name === fieldDueDate);

        // Extract action description and due date from document
        let actionDescription = 'Action erforderlich';
        let dueDate: string | null = null;

        if (doc.custom_fields && doc.custom_fields.length > 0) {
          for (const cf of doc.custom_fields) {
            if (actionDescField && cf.field === actionDescField.id && cf.value) {
              actionDescription = cf.value;
            }
            if (dueDateField && cf.field === dueDateField.id && cf.value) {
              dueDate = cf.value;
            }
          }
        }

        // Build description with notes if available
        let fullDescription = actionDescription;
        if (doc.notes && typeof doc.notes === 'string' && doc.notes.trim().length > 0) {
          fullDescription = `${actionDescription}\n\n📝 Zusammenfassung:\n${doc.notes}`;
        }

        await logger.info(`[Document Updated] Creating calendar event and task for document ${doc.id}`);
        await logger.info(`[Document Updated] Action: "${actionDescription}", Due date: ${dueDate || 'none'}`);

        // Create calendar event
        const eventId = await createCalendarEvent(
          doc.title || `Dokument ${doc.id}`,
          fullDescription,
          dueDate,
          doc.id
        );

        // Create task
        const taskId = await createTask(
          doc.title || `Dokument ${doc.id}`,
          fullDescription,
          dueDate,
          doc.id
        );

        // Update or create document record in database
        const existingDoc = await prisma.document.findFirst({
          where: { paperlessId: doc.id },
        });

        if (existingDoc) {
          // Update existing record
          await prisma.document.updateMany({
            where: { paperlessId: doc.id },
            data: {
              googleEventId: eventId,
              googleTaskId: taskId,
            },
          });
        } else {
          // Create new record
          await prisma.document.create({
            data: {
              paperlessId: doc.id,
              googleEventId: eventId,
              googleTaskId: taskId,
              originalFilename: doc.title || `document-${doc.id}`,
              fileHash: `paperless-${doc.id}`, // Placeholder hash
              status: 'COMPLETED',
            },
          });
        }

        processed++;
        results.push({
          documentId: doc.id,
          status: 'success',
          eventId,
          taskId,
        });

        await logger.info(`[Document Updated] Successfully created calendar event and task for document ${doc.id}`);

        // Send email notification for action required document
        await sendActionRequiredEmail(
          doc.title || `Dokument ${doc.id}`,
          doc.id,
          actionDescription,
          dueDate
        );
      } catch (error: any) {
        await logger.error(`[Document Updated] Error processing document ${doc.id}:`, error);
        results.push({
          documentId: doc.id,
          status: 'error',
          error: error.message,
        });
      }
    }

    await logger.info(`[Document Updated] Completed processing. Processed: ${processed}, Skipped: ${skipped}`);

    return NextResponse.json({
      message: 'Documents processed',
      total: documents.length,
      processed,
      skipped,
      results,
    });
  } catch (error: any) {
    await logger.error('[Document Updated] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
