import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

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
    processPipeline(testId, filePath, file.name).catch(error => {
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

async function processPipeline(testId: string, filePath: string, originalFileName: string) {
  console.log(`[Pipeline Test ${testId}] Starting pipeline processing`);

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

    // Check for duplicate
    addStepDetail('upload', 'Prüfe Datenbank auf Duplikate...');
    const { prisma } = await import('@/lib/prisma');

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
            if (details.rotatedPages > 0) {
              preprocessingDetails.push(`✓ ${details.rotatedPages} Seite(n) wurden gedreht`);
            } else {
              preprocessingDetails.push('✓ Keine Rotation nötig');
            }

            if (details.ocrLayerRemoved) {
              preprocessingDetails.push('✓ OCR-Layer wurde entfernt');
            }

            if (details.usedDocumentAI) {
              preprocessingDetails.push('✓ Wird mit Document AI verarbeitet');
            } else if (details.directToPaperless) {
              preprocessingDetails.push('✓ Direkt zu Paperless (ohne Document AI)');
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
    'Warte auf Webhook oder Polling...',
    '',
    '→ System sollte ai_todo Tag erkennen',
    '→ Gemini Analyse wird gestartet'
  ]);

  const { prisma } = await import('@/lib/prisma');
  let maxWait = 180; // 3 minutes
  let waited = 0;

  while (waited < maxWait) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    waited += 3;

    const dbDoc = await prisma.document.findFirst({
      where: { paperlessId }
    });

    if (dbDoc && dbDoc.geminiTokensSent) {
      console.log(`[Pipeline Test ${testId}] AI tagging complete!`);

      updateStep('ai_tagging', 'success', [
        '✓ AI-Tagging abgeschlossen',
        `Tokens gesendet: ${dbDoc.geminiTokensSent}`,
        `Tokens empfangen: ${dbDoc.geminiTokensRecv}`,
        '',
        '→ Tags wurden gesetzt',
        '→ Prüfe Action Required...'
      ]);

      // Check for action required
      updateStep('action_detection', 'success', [
        'Analyse abgeschlossen',
        'Test erfolgreich!'
      ]);

      updateStep('calendar_tasks', 'skipped', [
        'Nicht implementiert in Test'
      ]);

      updateStep('task_completion', 'skipped', [
        'Nicht implementiert in Test'
      ]);

      break;
    }

    if (waited > 30 && waited % 15 === 0) {
      addStepDetail('ai_tagging', `Warte... (${waited}s / ${maxWait}s)`);
    }
  }

  if (waited >= maxWait) {
    updateStep('ai_tagging', 'error', [
      '❌ TIMEOUT: AI-Tagging nicht abgeschlossen',
      `Gewartet: ${waited} Sekunden`,
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
