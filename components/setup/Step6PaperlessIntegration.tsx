"use client"

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faArrowRight, faTag, faFileAlt, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useTranslations } from 'next-intl';


interface StepProps {
  onNext: (data: Record<string, any>) => void;
  onBack: () => void;
  data: Record<string, any>;
}

export default function Step6PaperlessIntegration({ onNext, onBack, data }: StepProps) {
  const t = useTranslations('setup');

  const { toast } = useToast();

  const [tagAiTodo, setTagAiTodo] = useState('ai_todo');
  const [tagActionRequired, setTagActionRequired] = useState('action_required');
  const [tagPaiperlessProcessed, setTagPaiperlessProcessed] = useState('paiperless_processed');
  const [fieldActionDescription, setFieldActionDescription] = useState('action_description');
  const [fieldDueDate, setFieldDueDate] = useState('due_date');
  const [loading, setLoading] = useState(true);

  // Load saved configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/setup/load-config?step=6');
        if (response.ok) {
          const savedData = await response.json();
          if (savedData.tagAiTodo) setTagAiTodo(savedData.tagAiTodo);
          if (savedData.tagActionRequired) setTagActionRequired(savedData.tagActionRequired);
          if (savedData.tagPaiperlessProcessed) setTagPaiperlessProcessed(savedData.tagPaiperlessProcessed);
          if (savedData.fieldActionDescription) setFieldActionDescription(savedData.fieldActionDescription);
          if (savedData.fieldDueDate) setFieldDueDate(savedData.fieldDueDate);
        }
      } catch (error) {
        console.error('Failed to load Paperless integration config:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const canProceed = tagAiTodo && tagActionRequired && tagPaiperlessProcessed && fieldActionDescription && fieldDueDate;

  const handleNext = async () => {
    if (!canProceed) return;

    try {
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 6,
          data: {
            tagAiTodo,
            tagActionRequired,
            tagPaiperlessProcessed,
            fieldActionDescription,
            fieldDueDate,
          }
        }),
      });

      onNext({});
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Paperless-Integration konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex justify-center items-center py-12">
        <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-accent mb-2">
            Step 6: Paperless-Integration
          </h2>
          <p className="text-muted-foreground">
            Konfigurieren Sie die Tag- und Feld-Namen, die pAIperless in Paperless-NGX verwendet.
          </p>
        </div>

        <div className="space-y-4">
          {/* Info Box */}
          <div className="p-4 border rounded-lg bg-blue-50 dark:bg-[hsl(0,0%,15%)]">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Wichtig:</strong> Diese Tags und Custom Fields müssen manuell in Ihrer Paperless-NGX Instanz angelegt werden.
              pAIperless wird sie automatisch verwenden, erstellt sie aber nicht selbst.
            </p>
          </div>

          {/* Tags Section */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <FontAwesomeIcon icon={faTag} />
              Tags
            </h3>

            {/* AI Todo Tag */}
            <div className="space-y-2">
              <Label htmlFor="tagAiTodo">AI Todo Tag</Label>
              <Input
                id="tagAiTodo"
                type="text"
                placeholder="ai_todo"
                value={tagAiTodo}
                onChange={(e) => setTagAiTodo(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Tag für Dokumente, die auf AI-Analyse warten. Wird nach dem OCR automatisch gesetzt und nach der Analyse entfernt.
              </p>
            </div>

            {/* Action Required Tag */}
            <div className="space-y-2">
              <Label htmlFor="tagActionRequired">Action Required Tag</Label>
              <Input
                id="tagActionRequired"
                type="text"
                placeholder="action_required"
                value={tagActionRequired}
                onChange={(e) => setTagActionRequired(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Tag für Dokumente, die eine Handlung erfordern (z.B. Zahlung, Kündigung). Wird automatisch gesetzt, wenn die AI eine Aktion erkennt.
              </p>
            </div>

            {/* pAIperless Processed Tag */}
            <div className="space-y-2">
              <Label htmlFor="tagPaiperlessProcessed">pAIperless Processed Tag</Label>
              <Input
                id="tagPaiperlessProcessed"
                type="text"
                placeholder="paiperless_processed"
                value={tagPaiperlessProcessed}
                onChange={(e) => setTagPaiperlessProcessed(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Tag um Dokumente zu markieren, die von pAIperless AI-analysiert wurden. Wird nach erfolgreicher Analyse automatisch gesetzt.
              </p>
            </div>
          </div>

          {/* Custom Fields Section */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <FontAwesomeIcon icon={faFileAlt} />
              Custom Fields
            </h3>

            {/* Action Description Field */}
            <div className="space-y-2">
              <Label htmlFor="fieldActionDescription">Aktionsbeschreibung Feld</Label>
              <Input
                id="fieldActionDescription"
                type="text"
                placeholder="action_description"
                value={fieldActionDescription}
                onChange={(e) => setFieldActionDescription(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Custom Field Name für die Beschreibung der erforderlichen Aktion (z.B. &quot;Rechnung bezahlen&quot;).
              </p>
            </div>

            {/* Due Date Field */}
            <div className="space-y-2">
              <Label htmlFor="fieldDueDate">{t('faelligkeitsdatum_feld')}</Label>
              <Input
                id="fieldDueDate"
                type="text"
                placeholder="due_date"
                value={fieldDueDate}
                onChange={(e) => setFieldDueDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Custom Field Name für das Fälligkeitsdatum der Aktion. Sollte vom Typ &quot;Date&quot; sein.
              </p>
            </div>
          </div>

          {/* Example Box */}
          <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
            <h4 className="font-semibold mb-2 text-sm">Beispiel Workflow:</h4>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>{t('dokument_wird_hochgeladen_und_mit_ocr_verarbeitet')}</li>
              <li>System setzt Tag &quot;<strong>{tagAiTodo}</strong>&quot;</li>
              <li>{t('gemini_ai_analysiert_das_dokument_und_entfernt_den')}</li>
              <li>Falls Handlung erkannt: Tag &quot;<strong>{tagActionRequired}</strong>&quot; wird gesetzt</li>
              <li>Fields &quot;<strong>{fieldActionDescription}</strong>{t('quot_und_quot')}<strong>{fieldDueDate}</strong>{t('quot_werden_gefuellt')}</li>
              <li>{t('google_calendar_event_und_task_werden_erstellt')}</li>
            </ol>
          </div>
        </div>

        <div className="flex justify-between pt-6">
          <Button onClick={onBack} variant="outline">
            <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
            Zurück
          </Button>
          <Button onClick={handleNext} disabled={!canProceed}>
            Weiter
            <FontAwesomeIcon icon={faArrowRight} className="ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
