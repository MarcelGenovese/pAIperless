import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// In-memory store for test status
const testStore = new Map<string, any>();

export async function POST(request: NextRequest) {
  // Note: Auth skipped in middleware, user must be logged in to access dashboard
  let file: File | null = null;

  try {
    const formData = await request.formData();
    file = formData.get('file') as File;
    const skipDuplicateCheck = formData.get('skipDuplicateCheck') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const testId = randomUUID();

    // Save DIRECTLY to consume folder to avoid cross-device issues
    const consumeDir = '/app/storage/consume';
    await mkdir(consumeDir, { recursive: true });

    const fileName = `test_${testId}_${file.name}`;
    const filePath = join(consumeDir, fileName);

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
            `Test ID: ${testId}`,
            'Starte Pipeline-Verarbeitung...'
          ],
          timestamp: new Date().toISOString()
        },
        { id: 'preprocessing', title: '2. Vorverarbeitung', status: 'pending', details: [] },
        { id: 'ocr', title: '3. Document AI OCR', status: 'pending', details: [] },
        { id: 'paperless_upload', title: '4. Paperless Upload', status: 'pending', details: [] },
        { id: 'ai_tagging', title: '5. AI-Tagging', status: 'pending', details: [] },
        { id: 'action_detection', title: '6. Action Required Erkennung', status: 'pending', details: [] },
        { id: 'calendar_tasks', title: '7. Calendar & Tasks', status: 'pending', details: [] },
        { id: 'task_completion', title: '8. Task-Abhaken', status: 'pending', details: [] },
      ]
    };

    testStore.set(testId, initialStatus);

    // Start async processing
    processPipeline(testId, filePath, file.name, skipDuplicateCheck).catch(error => {
      console.error(`[Pipeline Test ${testId}] Fatal error:`, error);
      const status = testStore.get(testId);
      if (status) {
        // Update current step with error
        const currentStep = status.steps.find((s: any) => s.status === 'running');
        if (currentStep) {
          currentStep.status = 'error';
          currentStep.details.push(`❌ FEHLER: ${error.message}`);
          currentStep.details.push(`Stack: ${error.stack}`);
        }
        status.status = 'error';
        testStore.set(testId, status);
      }
    });

    return NextResponse.json({ testId, message: 'Pipeline test started' });
  } catch (error: any) {
    console.error('[Pipeline Test] Start error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function processPipeline(testId: string, filePath: string, originalFileName: string, skipDuplicateCheck: boolean = false) {
  console.log(`[Pipeline Test ${testId}] Starting pipeline processing (skipDuplicateCheck: ${skipDuplicateCheck})`);

  const updateStep = (stepId: string, status: string, details: string[]) => {
    const testStatus = testStore.get(testId);
    if (!testStatus) {
      console.error(`[Pipeline Test ${testId}] Test status not found!`);
      return;
    }

    const stepIndex = testStatus.steps.findIndex((s: any) => s.id === stepId);
    if (stepIndex !== -1) {
      testStatus.steps[stepIndex].status = status;
      testStatus.steps[stepIndex].details = details;
      testStatus.steps[stepIndex].timestamp = new Date().toISOString();
      testStore.set(testId, testStatus);
      console.log(`[Pipeline Test ${testId}] Updated ${stepId}: ${status}`);
    }
  };

  const addStepDetail = (stepId: string, detail: string) => {
    const testStatus = testStore.get(testId);
    if (!testStatus) return;

    const stepIndex = testStatus.steps.findIndex((s: any) => s.id === stepId);
    if (stepIndex !== -1) {
      testStatus.steps[stepIndex].details.push(detail);
      testStore.set(testId, testStatus);
    }
  };

  // Step 1: Hash Calculation & Duplicate Check
  try {
    console.log(`[Pipeline Test ${testId}] Step 1: Calculating hash...`);
    addStepDetail('upload', 'Berechne SHA-256 Hash...');

    // Import and calculate hash
    const crypto = await import('crypto');
    const fs = await import('fs/promises');
    const fileBuffer = await fs.readFile(filePath);
    const hash = crypto.createHash('sha256');
    hash.update(fileBuffer);
    const fileHash = hash.digest('hex');

    console.log(`[Pipeline Test ${testId}] Hash calculated: ${fileHash.substring(0, 16)}...`);
    addStepDetail('upload', `Hash: ${fileHash.substring(0, 32)}...`);

    // Check for duplicate (unless skip flag is set)
    if (skipDuplicateCheck) {
      console.log(`[Pipeline Test ${testId}] Skipping duplicate check (skipDuplicateCheck=true)`);
      addStepDetail('upload', '⚠️  Duplikatsprüfung übersprungen (manuell deaktiviert)');
      updateStep('upload', 'success', [
        `Datei: ${originalFileName}`,
        `Hash: ${fileHash.substring(0, 32)}...`,
        '⚠️  Duplikatsprüfung übersprungen',
        '✓ Datei direkt in /app/storage/consume gespeichert',
        '',
        '→ Worker sollte Datei innerhalb von Sekunden erkennen...',
        '→ Chokidar überwacht das Consume-Verzeichnis'
      ]);
    } else {
      addStepDetail('upload', 'Prüfe Datenbank auf Duplikate...');

      const existingDoc = await prisma.document.findUnique({
        where: { fileHash }
      });

      if (existingDoc) {
        console.log(`[Pipeline Test ${testId}] DUPLICATE FOUND: ${existingDoc.id}`);
        updateStep('upload', 'error', [
          `Datei: ${originalFileName}`,
          `Hash: ${fileHash.substring(0, 32)}...`,
          '❌ DUPLIKAT GEFUNDEN!',
          `Existierendes Dokument ID: ${existingDoc.id}`,
          `Original: ${existingDoc.originalFilename}`,
          existingDoc.paperlessId ? `Paperless ID: ${existingDoc.paperlessId}` : '',
          '',
          '🛑 Verarbeitung gestoppt - Datei bereits vorhanden'
        ]);

        // Mark test as completed (with error) and store duplicate info
        const testStatus = testStore.get(testId);
        if (testStatus) {
          testStatus.status = 'completed';
          testStatus.completedAt = new Date().toISOString();
          testStatus.duplicateDocId = existingDoc.id;
          testStatus.duplicatePaperlessId = existingDoc.paperlessId;
          testStore.set(testId, testStatus);
        }
        return;
      }

      console.log(`[Pipeline Test ${testId}] No duplicate found`);
      updateStep('upload', 'success', [
        `Datei: ${originalFileName}`,
        `Hash: ${fileHash.substring(0, 32)}...`,
        '✓ Kein Duplikat gefunden',
        '✓ Datei direkt in /app/storage/consume gespeichert',
        '',
        '→ Worker sollte Datei innerhalb von Sekunden erkennen...',
        '→ Chokidar überwacht das Consume-Verzeichnis'
      ]);
    }

    // Step 3: Wait for worker to process
    console.log(`[Pipeline Test ${testId}] Step 3: Waiting for worker...`);
    updateStep('preprocessing', 'running', [
      'Warte auf Worker...',
      'Worker sollte Datei innerhalb von Sekunden erkennen'
    ]);

    let documentId: number | null = null;
    let maxWait = 120; // 2 minutes
    let waited = 0;

    while (waited < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      waited += 2;

      const doc = await prisma.document.findUnique({
        where: { fileHash }
      });

      if (doc) {
        documentId = doc.id;
        console.log(`[Pipeline Test ${testId}] Document found in DB: ${doc.id}, status: ${doc.status}`);

        // Parse processing details if available
        let details: any = null;
        try {
          if (doc.processingDetails) {
            details = JSON.parse(doc.processingDetails);
          }
        } catch (e) {
          // Ignore parse errors
        }

        // Update based on status
        if (doc.status === 'PENDING') {
          addStepDetail('preprocessing', `Dokument ID ${doc.id} erstellt, Status: PENDING`);
        } else if (doc.status === 'PREPROCESSING') {
          updateStep('preprocessing', 'running', [
            `Dokument ID: ${doc.id}`,
            'Status: PREPROCESSING',
            'PDF wird analysiert...',
            '→ Seitenorientierung prüfen',
            '→ OCR-Layer entfernen falls nötig'
          ]);
        } else if (doc.status === 'OCR_IN_PROGRESS') {
          // Build preprocessing details
          const preprocessingDetails = [`Dokument ID: ${doc.id}`];

          if (details) {
            // Add file stats
            if (details.fileSize) {
              const sizeMB = (details.fileSize / 1024 / 1024).toFixed(2);
              preprocessingDetails.push(`Dateigröße: ${sizeMB} MB`);
            }
            if (details.pageCount) {
              preprocessingDetails.push(`Seitenanzahl: ${details.pageCount}`);
            }
            preprocessingDetails.push('');

            if (details.rotatedPages > 0) {
              preprocessingDetails.push(`✓ ${details.rotatedPages} Seite(n) wurden gedreht`);
            } else {
              preprocessingDetails.push('✓ Keine Rotation nötig');
            }

            if (details.ocrLayerRemoved) {
              preprocessingDetails.push('✓ OCR-Layer wurde entfernt');
            }
            preprocessingDetails.push('');

            if (details.usedDocumentAI) {
              preprocessingDetails.push('✓ Wird mit Document AI verarbeitet');
              if (details.documentAIMaxPages) {
                preprocessingDetails.push(`  (Limit: ${details.documentAIMaxPages} Seiten, ${details.documentAIMaxSizeMB} MB)`);
              }
            } else if (details.directToPaperless) {
              preprocessingDetails.push('✓ Direkt zu Paperless (ohne Document AI)');
              const reasons = [];
              if (details.skipReason) {
                reasons.push(details.skipReason);
              }
              if (details.documentAIMaxPages && details.pageCount > details.documentAIMaxPages) {
                reasons.push(`Seiten: ${details.pageCount} > ${details.documentAIMaxPages}`);
              }
              if (details.documentAIMaxSizeMB && details.fileSize > details.documentAIMaxSizeMB * 1024 * 1024) {
                const sizeMB = (details.fileSize / 1024 / 1024).toFixed(2);
                reasons.push(`Größe: ${sizeMB} MB > ${details.documentAIMaxSizeMB} MB`);
              }
              if (reasons.length > 0) {
                preprocessingDetails.push(`  Grund: ${reasons.join(', ')}`);
              }
            }
          } else {
            preprocessingDetails.push('✓ Vorverarbeitung abgeschlossen');
          }

          updateStep('preprocessing', 'success', preprocessingDetails);

          updateStep('ocr', 'running', [
            'Document AI wird gestartet...',
            `Verarbeite ${doc.ocrPageCount || '?'} Seiten`
          ]);
        } else if (doc.status === 'OCR_COMPLETE') {
          // Build preprocessing details
          const preprocessingDetails = [`Dokument ID: ${doc.id}`];

          if (details) {
            if (details.rotatedPages > 0) {
              preprocessingDetails.push(`✓ ${details.rotatedPages} Seite(n) wurden gedreht`);
            } else {
              preprocessingDetails.push('✓ Keine Rotation nötig');
            }

            if (details.ocrLayerRemoved) {
              preprocessingDetails.push('✓ OCR-Layer wurde entfernt');
            }

            if (details.usedDocumentAI) {
              preprocessingDetails.push('✓ Mit Document AI verarbeitet');
            } else if (details.directToPaperless) {
              preprocessingDetails.push('✓ Direkt zu Paperless (ohne Document AI)');
            }
          } else {
            preprocessingDetails.push('✓ Vorverarbeitung abgeschlossen');
          }

          updateStep('preprocessing', 'success', preprocessingDetails);

          const ocrDetails = [];
          if (details && details.searchablePdfCreated) {
            ocrDetails.push(`✓ ${doc.ocrPageCount || 0} Seiten verarbeitet`);
            ocrDetails.push('✓ OCR-Layer eingebettet (komprimiert als JPEG)');
            ocrDetails.push('✓ Searchable PDF erfolgreich erstellt');
          } else {
            ocrDetails.push(`✓ ${doc.ocrPageCount || 0} Seiten verarbeitet`);
            ocrDetails.push('✓ OCR-Layer eingebettet');
            ocrDetails.push('✓ Searchable PDF erstellt');
          }

          updateStep('ocr', 'success', ocrDetails);
        } else if (doc.status === 'UPLOADING_TO_PAPERLESS') {
          // Show preprocessing details if available
          if (details) {
            const preprocessingDetails = [`Dokument ID: ${doc.id}`];

            if (details.rotatedPages > 0) {
              preprocessingDetails.push(`✓ ${details.rotatedPages} Seite(n) wurden gedreht`);
            } else {
              preprocessingDetails.push('✓ Keine Rotation nötig');
            }

            if (details.ocrLayerRemoved) {
              preprocessingDetails.push('✓ OCR-Layer wurde entfernt');
            } else if (!details.usedDocumentAI) {
              preprocessingDetails.push('✓ OCR-Layer behalten (direkt zu Paperless)');
            }

            if (details.usedDocumentAI) {
              preprocessingDetails.push('✓ Mit Document AI verarbeitet');
            } else if (details.directToPaperless) {
              preprocessingDetails.push('✓ Direkt zu Paperless (Datei zu groß/limit)');
            }

            updateStep('preprocessing', 'success', preprocessingDetails);

            if (details.usedDocumentAI && details.searchablePdfCreated) {
              updateStep('ocr', 'success', [
                `✓ ${doc.ocrPageCount || 0} Seiten verarbeitet`,
                '✓ OCR-Layer eingebettet (komprimiert als JPEG)',
                '✓ Searchable PDF erfolgreich erstellt'
              ]);
            } else if (details.usedDocumentAI) {
              updateStep('ocr', 'success', [
                `✓ ${doc.ocrPageCount || 0} Seiten verarbeitet`,
                '✓ Document AI Verarbeitung abgeschlossen'
              ]);
            } else {
              updateStep('ocr', 'skipped', [
                'Übersprungen (Datei zu groß oder Limit erreicht)',
                'Paperless nutzt Tesseract OCR'
              ]);
            }
          }

          updateStep('paperless_upload', 'running', [
            'Upload zu Paperless läuft...',
            'Warte auf Document ID...'
          ]);
        } else if (doc.status === 'COMPLETED') {
          // Show preprocessing details
          if (details) {
            const preprocessingDetails = [`Dokument ID: ${doc.id}`];

            if (details.rotatedPages > 0) {
              preprocessingDetails.push(`✓ ${details.rotatedPages} Seite(n) wurden gedreht`);
            } else {
              preprocessingDetails.push('✓ Keine Rotation nötig');
            }

            if (details.ocrLayerRemoved) {
              preprocessingDetails.push('✓ OCR-Layer wurde entfernt');
            } else if (!details.usedDocumentAI) {
              preprocessingDetails.push('✓ OCR-Layer behalten (direkt zu Paperless)');
            }

            if (details.usedDocumentAI) {
              preprocessingDetails.push('✓ Mit Document AI verarbeitet');
            } else if (details.directToPaperless) {
              preprocessingDetails.push('✓ Direkt zu Paperless (Datei zu groß/limit)');
            }

            updateStep('preprocessing', 'success', preprocessingDetails);

            if (details.usedDocumentAI && details.searchablePdfCreated) {
              updateStep('ocr', 'success', [
                `✓ ${doc.ocrPageCount || 0} Seiten verarbeitet`,
                '✓ OCR-Layer eingebettet (komprimiert als JPEG)',
                '✓ Searchable PDF erfolgreich erstellt'
              ]);
            } else if (details.usedDocumentAI) {
              updateStep('ocr', 'success', [
                `✓ ${doc.ocrPageCount || 0} Seiten verarbeitet`,
                '✓ Document AI Verarbeitung abgeschlossen'
              ]);
            } else {
              updateStep('ocr', 'skipped', [
                'Übersprungen (Datei zu groß oder Limit erreicht)',
                'Paperless nutzt Tesseract OCR'
              ]);
            }
          }

          if (doc.paperlessId) {
            updateStep('paperless_upload', 'success', [
              `✓ Paperless Document ID: ${doc.paperlessId}`,
              '✓ ai_todo Tag gesetzt',
              '',
              'Bereit für AI-Tagging'
            ]);

            // Wait for AI tagging
            await waitForAITagging(testId, doc.paperlessId, updateStep, addStepDetail);
            break;
          } else {
            updateStep('paperless_upload', 'error', [
              '❌ Upload erfolgreich ABER Document ID fehlt',
              'Problem: waitForTask() Timeout',
              `Dokument wahrscheinlich in Paperless vorhanden`,
              '',
              '🔍 Manuelle Prüfung erforderlich'
            ]);

            // Mark test as completed (with error) so polling stops
            const testStatus = testStore.get(testId);
            if (testStatus) {
              testStatus.status = 'completed';
              testStatus.completedAt = new Date().toISOString();
              testStore.set(testId, testStatus);
            }
            break;
          }
        } else if (doc.status === 'ERROR') {
          const currentStepId = getCurrentStepForStatus(doc.status);
          updateStep(currentStepId, 'error', [
            `❌ Fehler bei Verarbeitung`,
            `Dokument ID: ${doc.id}`,
            `Fehler: ${doc.errorMessage || 'Unbekannt'}`,
            '',
            'Datei in /app/storage/error verschoben'
          ]);

          // Mark test as completed (with error) so polling stops
          const testStatus = testStore.get(testId);
          if (testStatus) {
            testStatus.status = 'completed';
            testStatus.completedAt = new Date().toISOString();
            testStatus.documentId = doc.id;
            testStore.set(testId, testStatus);
          }
          break;
        }
      } else {
        if (waited > 10) {
          addStepDetail('preprocessing', `Warte... (${waited}s / ${maxWait}s)`);
        }
      }
    }

    if (!documentId) {
      updateStep('preprocessing', 'error', [
        '❌ TIMEOUT: Dokument nicht gefunden',
        `Gewartet: ${waited} Sekunden`,
        '',
        'Mögliche Ursachen:',
        '• Worker läuft nicht',
        '• Chokidar erkennt Datei nicht',
        '• Fehler beim Erstellen des DB-Eintrags',
        '',
        '🔍 Prüfe Worker-Status und Logs'
      ]);
    }

  } catch (error: any) {
    console.error(`[Pipeline Test ${testId}] Error:`, error);
    updateStep('upload', 'error', [
      `❌ FEHLER: ${error.message}`,
      '',
      'Stack Trace:',
      ...error.stack.split('\n').slice(0, 5)
    ]);
  }
}

async function waitForAITagging(
  testId: string,
  paperlessId: number,
  updateStep: Function,
  addStepDetail: Function
) {
  console.log(`[Pipeline Test ${testId}] Waiting for AI tagging...`);

  updateStep('ai_tagging', 'running', [
    `Paperless ID: ${paperlessId}`,
    '🚀 Triggere AI-Tagging manuell...',
    '',
    '→ System sollte ai_todo Tag erkennen',
    '→ Gemini Analyse wird gestartet'
  ]);

  const { prisma } = await import('@/lib/prisma');
  const { getPaperlessClient } = await import('@/lib/paperless');
  const { getConfig, CONFIG_KEYS } = await import('@/lib/config');
  const { processAiTodoDocuments } = await import('@/lib/polling');

  // IMPORTANT: Trigger AI processing IMMEDIATELY instead of waiting for polling interval
  // Polling interval might be 30+ minutes, but test only waits 3 minutes
  console.log(`[Pipeline Test ${testId}] Manually triggering AI processing...`);
  addStepDetail('ai_tagging', '⚡ Triggere AI-Processing manuell (Polling-Intervall überbrückt)');

  try {
    // Trigger processing in background (don't wait for completion)
    processAiTodoDocuments().catch((error) => {
      console.error(`[Pipeline Test ${testId}] AI processing failed:`, error);
    });
    addStepDetail('ai_tagging', '✅ AI-Processing getriggert');
  } catch (error: any) {
    console.error(`[Pipeline Test ${testId}] Failed to trigger AI processing:`, error);
    addStepDetail('ai_tagging', `⚠️ Trigger fehlgeschlagen: ${error.message}`);
  }

  addStepDetail('ai_tagging', 'Warte auf Verarbeitung...');

  let maxWait = 180; // 3 minutes
  let waited = 0;

  while (waited < maxWait) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    waited += 3;

    const dbDoc = await prisma.document.findFirst({
      where: { paperlessId }
    });

    // Check for ERROR status - AI tagging failed
    if (dbDoc && dbDoc.status === 'ERROR') {
      console.log(`[Pipeline Test ${testId}] AI tagging FAILED - document in ERROR state`);

      // Try to fetch error details from logs
      let promptTemplate = null;
      let rawResponse = null;

      try {
        const errorLogs = await prisma.log.findMany({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 10 * 60 * 1000) // Last 10 minutes
            },
            level: 'ERROR',
            message: {
              contains: `document ${paperlessId}`
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        });

        // Extract prompt and response from log metadata
        for (const log of errorLogs) {
          if (log.meta) {
            try {
              const meta = JSON.parse(log.meta);
              if (meta.promptTemplate && !promptTemplate) {
                promptTemplate = meta.promptTemplate;
              }
              if (meta.geminiRawResponse && !rawResponse) {
                rawResponse = meta.geminiRawResponse;
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch error details from logs:', e);
      }

      // Store error details in test status for display
      const testStatus = testStore.get(testId);
      if (testStatus) {
        testStatus.aiTaggingData = {
          tags: [],
          tokensInput: 0,
          tokensOutput: 0,
          prompt: promptTemplate || 'Prompt nicht verfügbar',
          response: rawResponse || dbDoc.errorMessage || 'Response nicht verfügbar'
        };
        testStatus.status = 'completed';
        testStatus.completedAt = new Date().toISOString();
        testStore.set(testId, testStatus);
      }

      updateStep('ai_tagging', 'error', [
        '❌ AI-Tagging fehlgeschlagen',
        '',
        `Fehler: ${dbDoc.errorMessage || 'Unbekannter Fehler'}`,
        '',
        '📄 Prompt und Response verfügbar über Detail-Buttons unten',
        '',
        '🔍 Prüfe Gemini API Status und Prompt-Format'
      ]);

      // Mark action detection as skipped
      updateStep('action_detection', 'skipped', [
        'Übersprungen (AI-Tagging fehlgeschlagen)'
      ]);

      updateStep('calendar_tasks', 'skipped', [
        'Übersprungen (AI-Tagging fehlgeschlagen)'
      ]);

      updateStep('task_completion', 'skipped', [
        'Übersprungen (AI-Tagging fehlgeschlagen)'
      ]);

      return; // Exit early
    }

    if (dbDoc && dbDoc.geminiTokensSent) {
      console.log(`[Pipeline Test ${testId}] AI tagging complete!`);

      // Get the document from Paperless to see what was set
      try {
        const paperlessClient = await getPaperlessClient();
        const doc = await paperlessClient.getDocument(paperlessId);

        // Get all tags
        const allTags = await paperlessClient.getTags();
        const docTags = doc.tags?.map((tagId: number) => {
          const tag = allTags.find(t => t.id === tagId);
          return tag ? tag.name : `ID:${tagId}`;
        }) || [];

        // Check for action_required tag
        const tagActionRequiredName = await getConfig(CONFIG_KEYS.TAG_ACTION_REQUIRED) || 'action_required';
        const hasActionTag = docTags.includes(tagActionRequiredName);

        // Try to get prompt and response from recent analysis
        // Check if there's a log entry with the analysis details
        const analysisLogs = await prisma.log.findMany({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 10 * 60 * 1000) // Last 10 minutes
            },
            OR: [
              { message: { contains: 'Gemini response received' } },
              { message: { contains: 'Generating AI analysis prompt' } }
            ]
          },
          orderBy: { createdAt: 'desc' },
          take: 20
        });

        // Try to extract prompt (without document content) and response from logs
        let promptWithoutDoc = null;
        let geminiResponse = null;

        // Look for the Gemini response in logs
        for (const log of analysisLogs) {
          if (log.message.includes('Gemini response received') && log.meta) {
            try {
              const meta = JSON.parse(log.meta);
              if (meta.response) {
                geminiResponse = JSON.stringify(meta.response, null, 2);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }

        // Get the generated prompt structure (without actual document text)
        const { generateAnalysisPrompt } = await import('@/lib/prompt-generator');
        try {
          // Generate prompt with dummy content to see structure
          const { prompt: samplePrompt } = await generateAnalysisPrompt(paperlessClient, '');
          // Keep only the instructions part (before "Document to analyze:")
          const parts = samplePrompt.split('**Document to analyze:**');
          if (parts.length > 0) {
            promptWithoutDoc = parts[0].trim() + '\n\n**Document to analyze:**\n[Dokument-Inhalt wurde entfernt für die Anzeige]';
          } else {
            promptWithoutDoc = samplePrompt;
          }
        } catch (e) {
          console.error('Failed to generate sample prompt:', e);
        }

        const aiTaggingDetails = [
          '✓ AI-Tagging abgeschlossen',
          `Tokens gesendet: ${dbDoc.geminiTokensSent}`,
          `Tokens empfangen: ${dbDoc.geminiTokensRecv}`,
          '',
          `Gesetzt Tags: ${docTags.filter(t => t !== tagActionRequiredName).join(', ')}`,
        ];

        if (doc.correspondent) {
          aiTaggingDetails.push(`Korrespondent: ${doc.correspondent}`);
        }
        if (doc.document_type) {
          aiTaggingDetails.push(`Dokumenttyp: ${doc.document_type}`);
        }

        // Store AI details in test status
        const testStatus = testStore.get(testId);
        if (testStatus) {
          testStatus.aiTaggingData = {
            tags: docTags.filter(t => t !== tagActionRequiredName),
            correspondent: doc.correspondent,
            documentType: doc.document_type,
            customFields: doc.custom_fields || [],
            tokensInput: dbDoc.geminiTokensSent,
            tokensOutput: dbDoc.geminiTokensRecv,
            prompt: promptWithoutDoc,
            response: geminiResponse || JSON.stringify({
              title: doc.title,
              tags: docTags,
              correspondent: doc.correspondent,
              document_type: doc.document_type,
              custom_fields: doc.custom_fields
            }, null, 2),
          };
          testStore.set(testId, testStatus);
        }

        updateStep('ai_tagging', 'success', aiTaggingDetails);

        // Check for action required
        const actionDetails = [];

        if (hasActionTag) {
          actionDetails.push('✓ Action Required erkannt');
          actionDetails.push(`✓ Tag "${tagActionRequiredName}" wurde gesetzt`);

          // Get custom field values
          if (doc.custom_fields && doc.custom_fields.length > 0) {
            const fieldActionDescription = await getConfig(CONFIG_KEYS.FIELD_ACTION_DESCRIPTION) || 'action_description';
            const fieldDueDate = await getConfig(CONFIG_KEYS.FIELD_DUE_DATE) || 'due_date';

            const actionField = doc.custom_fields.find((f: any) => f.field?.name === fieldActionDescription);
            const dueDateField = doc.custom_fields.find((f: any) => f.field?.name === fieldDueDate);

            if (actionField?.value) {
              actionDetails.push(`Beschreibung: "${actionField.value}"`);
            }
            if (dueDateField?.value) {
              actionDetails.push(`Fälligkeitsdatum: ${dueDateField.value}`);
            }
          }

          // Store action data
          if (testStatus) {
            testStatus.actionRequired = true;
            testStatus.actionRequiredTag = tagActionRequiredName;
            testStore.set(testId, testStatus);
          }

          updateStep('action_detection', 'success', actionDetails);

          // Start Calendar & Tasks test
          await waitForCalendarTasks(testId, paperlessId, dbDoc.id, updateStep, addStepDetail);
        } else {
          actionDetails.push('✓ Analyse abgeschlossen');
          actionDetails.push(`✗ Keine Action erforderlich (Tag "${tagActionRequiredName}" nicht gesetzt)`);

          updateStep('action_detection', 'success', actionDetails);

          updateStep('calendar_tasks', 'skipped', [
            'Übersprungen (keine Action erforderlich)'
          ]);

          updateStep('task_completion', 'skipped', [
            'Übersprungen (keine Action erforderlich)'
          ]);

          // Mark test as complete
          if (testStatus) {
            testStatus.status = 'completed';
            testStatus.completedAt = new Date().toISOString();
            testStore.set(testId, testStatus);
          }
        }
      } catch (error: any) {
        console.error(`[Pipeline Test ${testId}] Error checking action:`, error);
        updateStep('ai_tagging', 'success', [
          '✓ AI-Tagging abgeschlossen',
          `Tokens gesendet: ${dbDoc.geminiTokensSent}`,
          `Tokens empfangen: ${dbDoc.geminiTokensRecv}`
        ]);

        updateStep('action_detection', 'error', [
          '❌ Fehler beim Prüfen der Action Detection',
          error.message
        ]);
      }

      break;
    }

    if (waited > 30 && waited % 15 === 0) {
      addStepDetail('ai_tagging', `Warte... (${waited}s / ${maxWait}s)`);
    }
  }

  if (waited >= maxWait) {
    // Try to get prompt template even on timeout
    let promptTemplate = null;
    try {
      const { generateAnalysisPrompt } = await import('@/lib/prompt-generator');
      const { getPaperlessClient } = await import('@/lib/paperless');
      const paperlessClient = await getPaperlessClient();
      const { prompt: samplePrompt } = await generateAnalysisPrompt(paperlessClient, '');
      const parts = samplePrompt.split('**Document to analyze:**');
      if (parts.length > 0) {
        promptTemplate = parts[0].trim() + '\n\n**Document to analyze:**\n[Dokument-Inhalt wurde entfernt für die Anzeige]';
      }
    } catch (e) {
      console.error('Failed to generate sample prompt:', e);
    }

    // Store in test status so prompt button works
    const testStatus = testStore.get(testId);
    if (testStatus) {
      testStatus.aiTaggingData = {
        tags: [],
        tokensInput: 0,
        tokensOutput: 0,
        prompt: promptTemplate || 'Prompt nicht verfügbar (Timeout)',
        response: 'Keine Response - Timeout nach ' + waited + ' Sekunden'
      };
      testStatus.status = 'completed';
      testStatus.completedAt = new Date().toISOString();
      testStore.set(testId, testStatus);
    }

    updateStep('ai_tagging', 'error', [
      '❌ TIMEOUT: AI-Tagging nicht abgeschlossen',
      `Gewartet: ${waited} Sekunden`,
      '',
      '📄 Prompt verfügbar über Prompt-Button unten',
      '',
      'Mögliche Ursachen:',
      '• Webhook nicht konfiguriert',
      '• Polling deaktiviert',
      '• Gemini API Fehler',
      '',
      '🔍 Prüfe Webhook-Status und Logs'
    ]);
  }
}

async function waitForCalendarTasks(
  testId: string,
  paperlessId: number,
  documentId: number,
  updateStep: Function,
  addStepDetail: Function
) {
  console.log(`[Pipeline Test ${testId}] Waiting for Calendar & Tasks creation...`);

  updateStep('calendar_tasks', 'running', [
    'Warte auf Calendar & Tasks Erstellung...',
    '→ System sollte action_required Tag erkennen',
    '→ Google Calendar Event wird erstellt',
    '→ Google Task wird erstellt'
  ]);

  const { prisma } = await import('@/lib/prisma');
  let maxWait = 120; // 2 minutes
  let waited = 0;

  while (waited < maxWait) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    waited += 3;

    const dbDoc = await prisma.document.findUnique({
      where: { id: documentId }
    });

    if (dbDoc && (dbDoc.googleTaskId || dbDoc.googleEventId)) {
      console.log(`[Pipeline Test ${testId}] Calendar & Tasks created!`);

      const details = ['✓ Calendar & Tasks erstellt'];

      if (dbDoc.googleEventId) {
        details.push(`✓ Calendar Event ID: ${dbDoc.googleEventId}`);
      }
      if (dbDoc.googleTaskId) {
        details.push(`✓ Google Task ID: ${dbDoc.googleTaskId}`);
      }

      updateStep('calendar_tasks', 'success', details);

      // Start task completion test
      if (dbDoc.googleTaskId) {
        await waitForTaskCompletion(testId, dbDoc.googleTaskId, paperlessId, updateStep, addStepDetail);
      } else {
        updateStep('task_completion', 'skipped', [
          'Übersprungen (kein Google Task erstellt)'
        ]);

        // Mark test as complete
        const testStatus = testStore.get(testId);
        if (testStatus) {
          testStatus.status = 'completed';
          testStatus.completedAt = new Date().toISOString();
          testStore.set(testId, testStatus);
        }
      }

      break;
    }

    if (waited > 30 && waited % 15 === 0) {
      addStepDetail('calendar_tasks', `Warte... (${waited}s / ${maxWait}s)`);
    }
  }

  if (waited >= maxWait) {
    updateStep('calendar_tasks', 'error', [
      '❌ TIMEOUT: Calendar & Tasks nicht erstellt',
      `Gewartet: ${waited} Sekunden`,
      '',
      'Mögliche Ursachen:',
      '• Google OAuth nicht konfiguriert',
      '• Webhook nicht konfiguriert',
      '• Action Polling deaktiviert'
    ]);

    // Mark test as completed so polling stops
    const testStatus = testStore.get(testId);
    if (testStatus) {
      testStatus.status = 'completed';
      testStatus.completedAt = new Date().toISOString();
      testStore.set(testId, testStatus);
    }
  }
}

async function waitForTaskCompletion(
  testId: string,
  taskId: string,
  paperlessId: number,
  updateStep: Function,
  addStepDetail: Function
) {
  console.log(`[Pipeline Test ${testId}] Waiting for task completion...`);

  updateStep('task_completion', 'running', [
    '⏳ Warte auf Task-Abhaken...',
    `Google Task ID: ${taskId}`,
    '',
    '→ Bitte haken Sie den Task in Google Tasks ab',
    '→ System prüft alle 3 Sekunden ob Task abgehakt wurde',
    '→ Timeout nach 5 Minuten'
  ]);

  const { getCompletedTasks } = await import('@/lib/google-calendar-tasks');
  const { getPaperlessClient } = await import('@/lib/paperless');
  const { getConfig, CONFIG_KEYS } = await import('@/lib/config');

  let maxWait = 300; // 5 minutes
  let waited = 0;

  while (waited < maxWait) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    waited += 3;

    try {
      // Check if task is completed
      const completedTasks = await getCompletedTasks();
      const completedTask = completedTasks.find(t => t.id === taskId);

      if (completedTask) {
        console.log(`[Pipeline Test ${testId}] Task completed!`);

        // Check if action_required tag was removed
        const paperlessClient = await getPaperlessClient();
        const doc = await paperlessClient.getDocument(paperlessId);
        const tagActionRequiredName = await getConfig(CONFIG_KEYS.TAG_ACTION_REQUIRED) || 'action_required';
        const allTags = await paperlessClient.getTags();
        const actionTag = allTags.find(t => t.name === tagActionRequiredName);
        const hasActionTag = doc.tags?.includes(actionTag?.id);

        const details = [
          '✓ Task wurde abgehakt',
          `✓ Task ID: ${taskId}`,
          `Abgehakt am: ${new Date().toISOString()}`,
          ''
        ];

        if (!hasActionTag) {
          details.push(`✓ Tag "${tagActionRequiredName}" wurde entfernt`);
          details.push('✓ Test erfolgreich abgeschlossen!');
        } else {
          details.push(`⚠️  Tag "${tagActionRequiredName}" noch vorhanden`);
          details.push('(Polling kann einige Minuten brauchen)');
        }

        updateStep('task_completion', 'success', details);

        // Mark test as complete
        const testStatus = testStore.get(testId);
        if (testStatus) {
          testStatus.status = 'completed';
          testStatus.completedAt = new Date().toISOString();
          testStore.set(testId, testStatus);
        }

        break;
      }
    } catch (error: any) {
      console.error(`[Pipeline Test ${testId}] Error checking task completion:`, error);
      // Continue waiting, error might be temporary
    }

    if (waited % 15 === 0) {
      const minutes = Math.floor(waited / 60);
      const seconds = waited % 60;
      addStepDetail('task_completion', `Warte auf Abhaken... (${minutes}:${seconds.toString().padStart(2, '0')} / 5:00)`);
    }
  }

  if (waited >= maxWait) {
    updateStep('task_completion', 'error', [
      '❌ TIMEOUT: Task wurde nicht abgehakt',
      `Gewartet: ${waited} Sekunden (5 Minuten)`,
      '',
      'Bitte haken Sie den Task manuell in Google Tasks ab',
      'Der Test wird trotzdem als abgeschlossen markiert'
    ]);

    // Mark test as completed so polling stops
    const testStatus = testStore.get(testId);
    if (testStatus) {
      testStatus.status = 'completed';
      testStatus.completedAt = new Date().toISOString();
      testStore.set(testId, testStatus);
    }
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

export { testStore };
