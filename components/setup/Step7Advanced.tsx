"use client"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faArrowRight, faCog, faClock } from '@fortawesome/free-solid-svg-icons';

interface StepProps {
  onNext: (data: Record<string, any>) => void;
  onBack: () => void;
  data: Record<string, any>;
}

export default function Step7Advanced({ onNext, onBack, data }: StepProps) {
  const { toast } = useToast();

  // Consume folder polling is always enabled (filesystem watcher)
  const [pollConsumeEnabled] = useState(true);
  const [pollConsumeInterval, setPollConsumeInterval] = useState('10');

  const [pollActionEnabled, setPollActionEnabled] = useState(true);
  const [pollActionInterval, setPollActionInterval] = useState('30');

  const [pollAiTodoEnabled, setPollAiTodoEnabled] = useState(true);
  const [pollAiTodoInterval, setPollAiTodoInterval] = useState('30');

  const canProceed = true; // All fields have defaults

  const handleNext = async () => {
    try {
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 7,
          data: {
            pollConsumeEnabled,
            pollConsumeInterval: parseInt(pollConsumeInterval, 10),
            pollActionEnabled,
            pollActionInterval: parseInt(pollActionInterval, 10),
            pollAiTodoEnabled,
            pollAiTodoInterval: parseInt(pollAiTodoInterval, 10),
          }
        }),
      });

      onNext({});
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Erweiterte Einstellungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-accent mb-2">
            Step 7: Erweiterte Einstellungen
          </h2>
          <p className="text-muted-foreground">
            Konfigurieren Sie Polling-Intervalle und erweiterte Optionen für die Dokumentenverarbeitung.
          </p>
        </div>

        <div className="space-y-4">
          {/* Info Box */}
          <div className="p-4 border rounded-lg bg-blue-50 dark:bg-[hsl(0,0%,15%)]">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <FontAwesomeIcon icon={faClock} className="mr-2" />
              <strong>Hinweis:</strong> Kürzere Intervalle bedeuten schnellere Reaktion, aber auch höhere Serverlast und API-Kosten.
              Die Standardwerte sind für die meisten Anwendungsfälle optimal.
            </p>
          </div>

          {/* Consume Folder Polling */}
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-semibold">
                  <FontAwesomeIcon icon={faCog} className="mr-2" />
                  Consume Folder Monitoring
                </Label>
                <p className="text-xs text-muted-foreground">
                  Überwacht den /consume Ordner auf neue PDF-Dateien.
                </p>
              </div>
              <div className="text-sm text-green-600 font-medium">
                Immer aktiv (Filesystem Watcher)
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pollConsumeInterval">
                Scan-Intervall (Minuten) - Fallback wenn Watcher ausfällt
              </Label>
              <Input
                id="pollConsumeInterval"
                type="number"
                min="1"
                max="120"
                value={pollConsumeInterval}
                onChange={(e) => setPollConsumeInterval(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Zusätzliches periodisches Scannen als Backup. Standard: 10 Minuten.
              </p>
            </div>
          </div>

          {/* Action Required Polling */}
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="pollActionEnabled" className="text-base font-semibold">
                  Action Required Polling
                </Label>
                <p className="text-xs text-muted-foreground">
                  Prüft regelmäßig Dokumente mit &quot;action_required&quot; Tag auf Task-Status.
                </p>
              </div>
              <Switch
                id="pollActionEnabled"
                checked={pollActionEnabled}
                onCheckedChange={setPollActionEnabled}
              />
            </div>
            {pollActionEnabled && (
              <div className="space-y-2">
                <Label htmlFor="pollActionInterval">Intervall (Minuten)</Label>
                <Input
                  id="pollActionInterval"
                  type="number"
                  min="5"
                  max="1440"
                  value={pollActionInterval}
                  onChange={(e) => setPollActionInterval(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Wie oft soll geprüft werden, ob Tasks in Google Tasks erledigt wurden. Standard: 30 Minuten.
                </p>
              </div>
            )}
          </div>

          {/* AI Todo Polling */}
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="pollAiTodoEnabled" className="text-base font-semibold">
                  AI Todo Polling
                </Label>
                <p className="text-xs text-muted-foreground">
                  Prüft regelmäßig Dokumente mit &quot;ai_todo&quot; Tag für Gemini-Analyse (Fallback zu Webhooks).
                </p>
              </div>
              <Switch
                id="pollAiTodoEnabled"
                checked={pollAiTodoEnabled}
                onCheckedChange={setPollAiTodoEnabled}
              />
            </div>
            {pollAiTodoEnabled && (
              <div className="space-y-2">
                <Label htmlFor="pollAiTodoInterval">Intervall (Minuten)</Label>
                <Input
                  id="pollAiTodoInterval"
                  type="number"
                  min="5"
                  max="1440"
                  value={pollAiTodoInterval}
                  onChange={(e) => setPollAiTodoInterval(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Wie oft soll nach Dokumenten gesucht werden, die AI-Analyse benötigen. Standard: 30 Minuten.
                </p>
              </div>
            )}
          </div>

          {/* Performance Warning */}
          <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-[hsl(45,40%,15%)]">
            <p className="text-sm text-yellow-900 dark:text-yellow-100">
              <strong>⚠️ Performance-Hinweis:</strong> Sehr kurze Polling-Intervalle (&lt; 10 Minuten) können bei großen Dokumentenbeständen
              zu erhöhter Serverlast und API-Kosten führen. Webhooks sind die bevorzugte Methode für Echtzeitverarbeitung.
            </p>
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
