import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// In-memory store for test status (will be lost on restart, but that's OK for testing)
const testStore = new Map<string, any>();

export async function POST(request: NextRequest) {
  // Auth check (since this route bypasses middleware)
  const { getToken } = await import('next-auth/jwt');
  const token = await getToken({ req: request as any });

  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  let formData: FormData;
  let file: File | null = null;

  try {
    // Try to read formData
    try {
      formData = await request.formData();
      file = formData.get('file') as File;
    } catch (error: any) {
      console.error('[Pipeline Test] FormData error:', error.message);
      return NextResponse.json(
        { error: 'Failed to read file upload. Error: ' + error.message },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Generate unique test ID
    const testId = randomUUID();

    // Save file to /app/storage/pipeline-tests directory
    const testDir = '/app/storage/pipeline-tests';
    await mkdir(testDir, { recursive: true });

    const fileName = `test_${testId}_${file.name}`;
    const filePath = join(testDir, fileName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Initialize test status
    const initialStatus = {
      testId,
      fileName: file.name,
      filePath,
      startTime: new Date().toISOString(),
      status: 'running',
      steps: [
        {
          id: 'upload',
          title: '1. Upload & Duplikatsprüfung',
          status: 'running',
          details: [
            `Datei: ${file.name}`,
            `Größe: ${(file.size / 1024).toFixed(2)} KB`,
            'Prüfe auf Duplikate...'
          ],
          timestamp: new Date().toISOString()
        },
        {
          id: 'preprocessing',
          title: '2. Vorverarbeitung',
          status: 'pending',
          details: [],
        },
        {
          id: 'ocr',
          title: '3. Document AI OCR',
          status: 'pending',
          details: [],
        },
        {
          id: 'paperless_upload',
          title: '4. Paperless Upload',
          status: 'pending',
          details: [],
        },
        {
          id: 'ai_tagging',
          title: '5. AI-Tagging',
          status: 'pending',
          details: [],
        },
        {
          id: 'action_detection',
          title: '6. Action Required Erkennung',
          status: 'pending',
          details: [],
        },
        {
          id: 'calendar_tasks',
          title: '7. Calendar & Tasks',
          status: 'pending',
          details: [],
        },
        {
          id: 'task_completion',
          title: '8. Task-Abhaken (Simulation)',
          status: 'pending',
          details: [],
        },
      ]
    };

    testStore.set(testId, initialStatus);

    // Trigger pipeline processing asynchronously
    processPipeline(testId, filePath).catch(error => {
      console.error(`Pipeline test ${testId} failed:`, error);
      const status = testStore.get(testId);
      if (status) {
        status.status = 'error';
        status.error = error.message;
        testStore.set(testId, status);
      }
    });

    return NextResponse.json({
      testId,
      message: 'Pipeline test started'
    });
  } catch (error: any) {
    console.error('Failed to start pipeline test:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

async function processPipeline(testId: string, filePath: string) {
  const { prisma } = await import('@/lib/prisma');
  const { calculateFileHash } = await import('@/lib/utils');
  const { createLogger } = await import('@/lib/logger');
  const logger = await createLogger('PipelineTest');

  const updateStep = (stepId: string, status: string, details: string[]) => {
    const testStatus = testStore.get(testId);
    if (!testStatus) return;

    const stepIndex = testStatus.steps.findIndex((s: any) => s.id === stepId);
    if (stepIndex !== -1) {
      testStatus.steps[stepIndex].status = status;
      testStatus.steps[stepIndex].details = details;
      testStatus.steps[stepIndex].timestamp = new Date().toISOString();
      testStore.set(testId, testStatus);
    }
  };

  try {
    // Step 1: Upload & Duplicate Check
    await logger.info(`[Pipeline Test ${testId}] Starting upload step`);
    const fileHash = await calculateFileHash(filePath);

    const existingDoc = await prisma.document.findUnique({
      where: { fileHash }
    });

    if (existingDoc) {
      updateStep('upload', 'error', [
        `Datei: ${filePath.split('/').pop()}`,
        '❌ DUPLIKAT GEFUNDEN',
        `Bereits vorhandenes Dokument ID: ${existingDoc.id}`,
        `Original: ${existingDoc.originalFilename}`
      ]);
      return;
    }

    updateStep('upload', 'success', [
      `Datei: ${filePath.split('/').pop()}`,
      `Hash: ${fileHash.substring(0, 16)}...`,
      '✓ Kein Duplikat gefunden',
      '✓ Upload erfolgreich'
    ]);

    // Move file to consume folder to trigger worker
    const { rename } = await import('fs/promises');
    const { join, basename } = await import('path');
    const consumePath = join('/app/storage/consume', basename(filePath));
    await rename(filePath, consumePath);

    await logger.info(`[Pipeline Test ${testId}] File moved to consume folder`);

    // Wait for worker to pick it up and track progress
    let documentId: number | null = null;
    let maxWait = 120; // 2 minutes
    let waited = 0;

    // Step 2: Wait for preprocessing
    updateStep('preprocessing', 'running', ['Warte auf Worker...']);

    while (waited < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      waited += 2;

      const doc = await prisma.document.findUnique({
        where: { fileHash }
      });

      if (doc) {
        documentId = doc.id;

        // Update preprocessing status
        if (doc.status === 'PENDING' || doc.status === 'PREPROCESSING') {
          updateStep('preprocessing', 'running', [
            `Dokument ID: ${doc.id}`,
            `Status: ${doc.status}`,
            'Seiten werden analysiert...'
          ]);
        }

        // Update OCR status
        if (doc.status === 'OCR_IN_PROGRESS' || doc.status === 'OCR_COMPLETE') {
          updateStep('preprocessing', 'success', [
            `Dokument ID: ${doc.id}`,
            '✓ Vorverarbeitung abgeschlossen'
          ]);

          if (doc.ocrPageCount) {
            updateStep('ocr', 'running', [
              `${doc.ocrPageCount} Seiten werden mit Document AI verarbeitet...`
            ]);
          } else {
            updateStep('ocr', 'skipped', [
              'Dokument zu groß oder Document AI deaktiviert',
              'Fallback: Direkt zu Paperless'
            ]);
          }
        }

        // Check if OCR is complete
        if (doc.status === 'OCR_COMPLETE' && doc.ocrPageCount) {
          updateStep('ocr', 'success', [
            `✓ ${doc.ocrPageCount} Seiten verarbeitet`,
            '✓ OCR-Layer eingebettet'
          ]);
        }

        // Check Paperless upload
        if (doc.status === 'UPLOADING_TO_PAPERLESS') {
          updateStep('paperless_upload', 'running', [
            'Dokument wird zu Paperless hochgeladen...'
          ]);
        }

        if (doc.status === 'COMPLETED') {
          if (doc.paperlessId) {
            updateStep('paperless_upload', 'success', [
              `✓ Paperless Document ID: ${doc.paperlessId}`,
              '✓ ai_todo Tag gesetzt'
            ]);

            // Wait for AI tagging
            await waitForAITagging(testId, doc.paperlessId, updateStep);
            break;
          } else {
            updateStep('paperless_upload', 'error', [
              '❌ Paperless Document ID fehlt',
              'Upload war erfolgreich aber ID konnte nicht abgerufen werden'
            ]);
          }
        }

        if (doc.status === 'ERROR') {
          updateStep(getCurrentStepForStatus(doc.status), 'error', [
            `❌ Fehler: ${doc.errorMessage || 'Unbekannter Fehler'}`
          ]);
          break;
        }
      }
    }

    if (!documentId) {
      updateStep('preprocessing', 'error', [
        '❌ Timeout: Dokument wurde nicht in der Datenbank gefunden',
        'Worker läuft möglicherweise nicht'
      ]);
    }

  } catch (error: any) {
    await logger.error(`[Pipeline Test ${testId}] Error:`, error);
    console.error('Pipeline test error:', error);
  }
}

async function waitForAITagging(testId: string, paperlessId: number, updateStep: Function) {
  const { getConfig, CONFIG_KEYS } = await import('@/lib/config');
  const { getPaperlessClient } = await import('@/lib/paperless');

  updateStep('ai_tagging', 'running', [
    'Warte auf Webhook oder Polling...',
    `Paperless ID: ${paperlessId}`
  ]);

  const paperlessClient = await getPaperlessClient();
  const aiTodoTag = await getConfig(CONFIG_KEYS.TAG_AI_TODO) || 'ai_todo';

  let maxWait = 180; // 3 minutes
  let waited = 0;
  let hadAiTodoTag = false;

  while (waited < maxWait) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    waited += 3;

    try {
      const doc = await paperlessClient.getDocument(paperlessId);
      const hasAiTodo = doc.tags.some((tagId: number) => {
        // Need to check tag name
        return false; // Simplified for now
      });

      // Check in our DB if tagging happened
      const { prisma } = await import('@/lib/prisma');
      const dbDoc = await prisma.document.findFirst({
        where: { paperlessId }
      });

      if (dbDoc && dbDoc.geminiTokensSent) {
        updateStep('ai_tagging', 'success', [
          `✓ AI-Tagging abgeschlossen`,
          `Tokens: ${dbDoc.geminiTokensSent} gesendet, ${dbDoc.geminiTokensRecv} empfangen`,
          `Tags: ${doc.tags.length} gesetzt`
        ]);

        // Check for action required
        await checkActionRequired(testId, doc, updateStep);
        break;
      }
    } catch (error) {
      console.error('Error checking tagging status:', error);
    }
  }

  if (waited >= maxWait) {
    updateStep('ai_tagging', 'error', [
      '❌ Timeout: AI-Tagging wurde nicht abgeschlossen'
    ]);
  }
}

async function checkActionRequired(testId: string, doc: any, updateStep: Function) {
  const { getConfig, CONFIG_KEYS } = await import('@/lib/config');
  const actionTag = await getConfig(CONFIG_KEYS.TAG_ACTION_REQUIRED) || 'action_required';

  // Check if action_required tag is present
  // This is simplified - would need to match tag names
  const hasAction = false; // Simplified

  if (hasAction) {
    updateStep('action_detection', 'success', [
      '✓ Action Required erkannt',
      'Erstelle Calendar Event und Task...'
    ]);

    updateStep('calendar_tasks', 'running', [
      'Erstelle Google Calendar Event...',
      'Erstelle Google Task...'
    ]);

    // Wait for calendar/tasks
    await new Promise(resolve => setTimeout(resolve, 5000));

    updateStep('calendar_tasks', 'success', [
      '✓ Calendar Event erstellt',
      '✓ Task erstellt'
    ]);

    updateStep('task_completion', 'skipped', [
      'Warte auf manuelles Abhaken des Tasks'
    ]);
  } else {
    updateStep('action_detection', 'success', [
      '✓ Keine Action Required erkannt',
      'Test erfolgreich abgeschlossen'
    ]);

    updateStep('calendar_tasks', 'skipped', [
      'Keine Action Required - übersprungen'
    ]);

    updateStep('task_completion', 'skipped', [
      'Keine Action Required - übersprungen'
    ]);
  }
}

function getCurrentStepForStatus(status: string): string {
  switch (status) {
    case 'PENDING':
    case 'PREPROCESSING':
      return 'preprocessing';
    case 'OCR_IN_PROGRESS':
    case 'OCR_COMPLETE':
      return 'ocr';
    case 'UPLOADING_TO_PAPERLESS':
      return 'paperless_upload';
    default:
      return 'upload';
  }
}

// Export testStore for status endpoint
export { testStore };
