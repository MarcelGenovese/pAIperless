"use client"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faArrowRight, faTag, faFileAlt } from '@fortawesome/free-solid-svg-icons';

interface StepProps {
  onNext: (data: Record<string, any>) => void;
  onBack: () => void;
  data: Record<string, any>;
}

export default function Step6PaperlessIntegration({ onNext, onBack, data }: StepProps) {
  const { toast } = useToast();

  const [tagAiTodo, setTagAiTodo] = useState('ai_todo');
  const [tagActionRequired, setTagActionRequired] = useState('action_required');
  const [fieldActionDescription, setFieldActionDescription] = useState('action_description');
  const [fieldDueDate, setFieldDueDate] = useState('due_date');

  const canProceed = tagAiTodo && tagActionRequired && fieldActionDescription && fieldDueDate;

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
          <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
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
              <Label htmlFor="fieldDueDate">Fälligkeitsdatum Feld</Label>
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
              <li>Dokument wird hochgeladen und mit OCR verarbeitet</li>
              <li>System setzt Tag &quot;<strong>{tagAiTodo}</strong>&quot;</li>
              <li>Gemini AI analysiert das Dokument und entfernt den Tag</li>
              <li>Falls Handlung erkannt: Tag &quot;<strong>{tagActionRequired}</strong>&quot; wird gesetzt</li>
              <li>Fields &quot;<strong>{fieldActionDescription}</strong>&quot; und &quot;<strong>{fieldDueDate}</strong>&quot; werden gefüllt</li>
              <li>Google Calendar Event und Task werden erstellt</li>
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
