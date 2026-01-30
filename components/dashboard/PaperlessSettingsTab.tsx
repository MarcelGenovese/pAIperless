"use client"

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faEye, faEyeSlash, faSpinner, faSave } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';

interface PaperlessSettingsTabProps {
  initialData?: {
    paperlessUrl?: string;
    paperlessToken?: string;
    pollConsumeEnabled?: boolean;
    pollConsumeInterval?: string;
    pollActionEnabled?: boolean;
    pollActionInterval?: string;
    pollAiTodoEnabled?: boolean;
    pollAiTodoInterval?: string;
  };
}

export default function PaperlessSettingsTab({ initialData = {} }: PaperlessSettingsTabProps) {
  const { toast } = useToast();

  const [paperlessData, setPaperlessData] = useState({
    url: initialData.paperlessUrl || '',
    token: initialData.paperlessToken || '',
    tested: false,
  });
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  // OCR Settings Check
  const [ocrStatus, setOcrStatus] = useState<{
    valid: boolean;
    mode: string;
    message: string;
  } | null>(null);
  const [checkingOCR, setCheckingOCR] = useState(false);

  // Workflows Check
  const [workflowStatus, setWorkflowStatus] = useState<{
    valid: boolean;
    message: string;
    created?: number;
    existing?: number;
    failed?: number;
  } | null>(null);
  const [checkingWorkflows, setCheckingWorkflows] = useState(false);
  const [creatingWorkflows, setCreatingWorkflows] = useState(false);

  const [pollingData, setPollingData] = useState({
    pollConsumeEnabled: initialData.pollConsumeEnabled || false,
    pollConsumeInterval: initialData.pollConsumeInterval || '10',
    pollActionEnabled: initialData.pollActionEnabled || false,
    pollActionInterval: initialData.pollActionInterval || '30',
    pollAiTodoEnabled: initialData.pollAiTodoEnabled || false,
    pollAiTodoInterval: initialData.pollAiTodoInterval || '30',
  });

  const testPaperless = async () => {
    if (!paperlessData.url || !paperlessData.token) {
      toast({
        title: 'Fehler',
        description: 'Bitte URL und Token angeben',
        variant: 'destructive',
      });
      return;
    }

    setTesting(true);
    try {
      const response = await fetch('/api/setup/test-paperless', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperlessUrl: paperlessData.url,
          paperlessToken: paperlessData.token,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setPaperlessData({ ...paperlessData, tested: true });
        toast({
          title: 'Verbindung erfolgreich',
          description: 'Paperless-NGX ist erreichbar',
          variant: 'success',
        });
      } else {
        toast({
          title: 'Verbindung fehlgeschlagen',
          description: result.error || 'Fehler beim Verbinden',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Verbindung fehlgeschlagen',
        description: 'Netzwerkfehler',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const savePaperless = async () => {
    setSaving(true);
    try {
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 1,
          data: {
            paperlessUrl: paperlessData.url,
            paperlessToken: paperlessData.token,
          },
        }),
      });

      toast({
        title: 'Gespeichert',
        description: 'Paperless-NGX Einstellungen gespeichert',
        variant: 'success',
      });

      setPaperlessData({ ...paperlessData, tested: false });
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Konnte nicht speichern',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const checkOCRSettings = async () => {
    setCheckingOCR(true);
    try {
      const response = await fetch('/api/paperless/check-ocr');
      const result = await response.json();

      if (response.ok) {
        setOcrStatus(result);

        if (result.valid) {
          toast({
            title: 'OCR-Einstellungen korrekt',
            description: result.message,
            variant: 'success',
          });
        } else {
          toast({
            title: 'OCR-Einstellungen prüfen',
            description: result.message,
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Fehler',
          description: result.error || 'Konnte OCR-Einstellungen nicht prüfen',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Netzwerkfehler beim Prüfen der OCR-Einstellungen',
        variant: 'destructive',
      });
    } finally {
      setCheckingOCR(false);
    }
  };

  const checkWorkflows = async () => {
    setCheckingWorkflows(true);
    setWorkflowStatus(null);

    try {
      const response = await fetch('/api/webhooks/validate');
      const result = await response.json();

      if (response.ok) {
        const validCount = result.workflows?.filter((w: any) => w.hasWebhook && w.apiKeyMatch).length || 0;
        const totalRequired = 2;

        if (validCount === totalRequired) {
          setWorkflowStatus({
            valid: true,
            message: 'Alle erforderlichen Workflows sind korrekt konfiguriert',
          });
          toast({
            title: 'Workflows korrekt',
            description: 'Alle Workflows sind vorhanden und korrekt konfiguriert',
          });
        } else {
          const missingCount = totalRequired - validCount;
          setWorkflowStatus({
            valid: false,
            message: `${missingCount} Workflow(s) fehlen oder sind falsch konfiguriert`,
          });
          toast({
            title: 'Workflows prüfen',
            description: `${missingCount} Workflow(s) müssen erstellt oder aktualisiert werden`,
            variant: 'destructive',
          });
        }
      } else {
        setWorkflowStatus({
          valid: false,
          message: result.error || 'Konnte Workflows nicht prüfen',
        });
        toast({
          title: 'Fehler',
          description: result.error || 'Konnte Workflows nicht prüfen',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Netzwerkfehler beim Prüfen der Workflows',
        variant: 'destructive',
      });
    } finally {
      setCheckingWorkflows(false);
    }
  };

  const createWorkflows = async () => {
    setCreatingWorkflows(true);

    try {
      const response = await fetch('/api/webhooks/create-workflows', {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        const createdCount = result.created?.length || 0;
        const existingCount = result.existing?.length || 0;

        setWorkflowStatus({
          valid: true,
          message: `${createdCount} Workflow(s) erstellt, ${existingCount} existierten bereits`,
          created: createdCount,
          existing: existingCount,
        });

        if (createdCount > 0) {
          toast({
            title: 'Workflows erstellt',
            description: `${createdCount} Workflow(s) wurden erfolgreich erstellt`,
          });
        } else {
          toast({
            title: 'Workflows vorhanden',
            description: 'Alle erforderlichen Workflows existieren bereits',
          });
        }

        // Check workflows after creation
        await checkWorkflows();
      } else {
        const failedCount = result.failed?.length || 0;
        setWorkflowStatus({
          valid: false,
          message: result.error || `${failedCount} Workflow(s) konnten nicht erstellt werden`,
          failed: failedCount,
        });
        toast({
          title: 'Fehler',
          description: result.error || 'Konnte Workflows nicht erstellen',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Netzwerkfehler beim Erstellen der Workflows',
        variant: 'destructive',
      });
    } finally {
      setCreatingWorkflows(false);
    }
  };

  const savePolling = async () => {
    try {
      // Save polling settings
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 7,
          data: pollingData,
        }),
      });

      // Restart polling with new settings
      await fetch('/api/polling/restart', {
        method: 'POST',
      });

      toast({
        title: 'Gespeichert',
        description: 'Polling Einstellungen gespeichert und Polling neu gestartet',
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Konnte nicht speichern',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection */}
      <Card>
        <CardHeader>
          <CardTitle>Paperless-NGX Verbindung</CardTitle>
          <CardDescription>Verbindung zu Ihrer Paperless-NGX Instanz</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="paperless-url">Paperless URL</Label>
            <Input
              id="paperless-url"
              value={paperlessData.url}
              onChange={(e) => setPaperlessData({ ...paperlessData, url: e.target.value, tested: false })}
              placeholder="http://paperless:8000"
            />
          </div>
          <div>
            <Label htmlFor="paperless-token">API Token</Label>
            <div className="flex gap-2">
              <Input
                id="paperless-token"
                type={showToken ? 'text' : 'password'}
                value={paperlessData.token}
                onChange={(e) => setPaperlessData({ ...paperlessData, token: e.target.value, tested: false })}
                placeholder="Token von Paperless-NGX"
              />
              <Button variant="outline" onClick={() => setShowToken(!showToken)} size="icon">
                <FontAwesomeIcon icon={showToken ? faEyeSlash : faEye} />
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={testPaperless} variant="outline" disabled={testing || saving}>
              <FontAwesomeIcon icon={testing ? faSpinner : faCheckCircle} className={`mr-2 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Teste...' : 'Verbindung testen'}
            </Button>
            <Button onClick={savePaperless} disabled={testing || saving}>
              <FontAwesomeIcon icon={saving ? faSpinner : faSave} className={`mr-2 ${saving ? 'animate-spin' : ''}`} />
              {saving ? 'Speichert...' : 'Speichern'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* OCR Settings Check */}
      <Card>
        <CardHeader>
          <CardTitle>Paperless OCR-Einstellungen</CardTitle>
          <CardDescription>
            Prüft ob Paperless korrekt konfiguriert ist um Document AI Ergebnisse nicht zu überschreiben
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
            <h4 className="font-semibold mb-2">ℹ️ Wichtig für Document AI</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Damit Paperless die OCR-Ergebnisse von Document AI nicht überschreibt, muss der OCR-Modus auf
              <strong className="text-foreground"> &quot;skip&quot; </strong> oder
              <strong className="text-foreground"> &quot;skip_noarchive&quot; </strong> gesetzt sein.
            </p>
            <p className="text-sm text-muted-foreground">
              Diese Einstellung kannst du in Paperless unter <strong>Administration → Settings → OCR</strong> ändern.
            </p>
          </div>

          {ocrStatus && (
            <div className={`p-4 border rounded-lg ${
              ocrStatus.valid
                ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-start gap-3">
                <FontAwesomeIcon
                  icon={ocrStatus.valid ? faCheckCircle : faCheckCircle}
                  className={`text-lg mt-0.5 ${
                    ocrStatus.valid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}
                />
                <div className="flex-1">
                  <h4 className={`font-semibold ${
                    ocrStatus.valid ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'
                  }`}>
                    {ocrStatus.valid ? 'Konfiguration korrekt' : 'Konfiguration prüfen'}
                  </h4>
                  <p className={`text-sm mt-1 ${
                    ocrStatus.valid ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                  }`}>
                    {ocrStatus.message}
                  </p>
                  <p className="text-xs mt-2 font-mono bg-white/50 dark:bg-black/20 px-2 py-1 rounded">
                    Aktueller Modus: {ocrStatus.mode}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Button onClick={checkOCRSettings} variant="outline" disabled={checkingOCR}>
            <FontAwesomeIcon
              icon={checkingOCR ? faSpinner : faCheckCircle}
              className={`mr-2 ${checkingOCR ? 'animate-spin' : ''}`}
            />
            {checkingOCR ? 'Prüfe...' : 'OCR-Einstellungen prüfen'}
          </Button>
        </CardContent>
      </Card>

      {/* Workflows Check */}
      <Card>
        <CardHeader>
          <CardTitle>Paperless Workflows</CardTitle>
          <CardDescription>
            Prüft und erstellt die erforderlichen Webhooks für die AI-Verarbeitung
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
            <h4 className="font-semibold mb-2">ℹ️ Erforderliche Workflows</h4>
            <p className="text-sm text-muted-foreground mb-2">
              pAIperless benötigt zwei Workflows in Paperless-NGX:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li><strong>paiperless_document_added</strong> - Triggert AI-Analyse bei neuen Dokumenten</li>
              <li><strong>paiperless_document_updated</strong> - Triggert Action-Verarbeitung bei Updates</li>
            </ul>
          </div>

          {workflowStatus && (
            <div className={`p-4 border rounded-lg ${
              workflowStatus.valid
                ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-start gap-3">
                <FontAwesomeIcon
                  icon={faCheckCircle}
                  className={`text-lg mt-0.5 ${
                    workflowStatus.valid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}
                />
                <div className="flex-1">
                  <h4 className={`font-semibold ${
                    workflowStatus.valid ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'
                  }`}>
                    {workflowStatus.valid ? 'Workflows korrekt' : 'Workflows prüfen'}
                  </h4>
                  <p className={`text-sm mt-1 ${
                    workflowStatus.valid ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                  }`}>
                    {workflowStatus.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={checkWorkflows} variant="outline" disabled={checkingWorkflows || creatingWorkflows}>
              <FontAwesomeIcon
                icon={checkingWorkflows ? faSpinner : faCheckCircle}
                className={`mr-2 ${checkingWorkflows ? 'animate-spin' : ''}`}
              />
              {checkingWorkflows ? 'Prüfe...' : 'Workflows prüfen'}
            </Button>
            <Button onClick={createWorkflows} disabled={checkingWorkflows || creatingWorkflows}>
              <FontAwesomeIcon
                icon={creatingWorkflows ? faSpinner : faSave}
                className={`mr-2 ${creatingWorkflows ? 'animate-spin' : ''}`}
              />
              {creatingWorkflows ? 'Erstelle...' : 'Workflows erstellen'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Polling Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Polling Einstellungen</CardTitle>
          <CardDescription>Fallback-Überwachung (Webhooks bevorzugt)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {/* Consume Folder Polling */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label htmlFor="poll-consume" className="text-base">Consume Folder Polling</Label>
                <p className="text-sm text-muted-foreground">Überwache /consume Ordner</p>
              </div>
              <Switch
                id="poll-consume"
                checked={pollingData.pollConsumeEnabled}
                onCheckedChange={(checked) => setPollingData({ ...pollingData, pollConsumeEnabled: checked })}
              />
            </div>
            {pollingData.pollConsumeEnabled && (
              <div>
                <Label htmlFor="poll-consume-interval">Intervall (Minuten)</Label>
                <Input
                  id="poll-consume-interval"
                  type="number"
                  value={pollingData.pollConsumeInterval}
                  onChange={(e) => setPollingData({ ...pollingData, pollConsumeInterval: e.target.value })}
                />
              </div>
            )}

            {/* Action Tag Polling */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label htmlFor="poll-action" className="text-base">Action Tag Polling</Label>
                <p className="text-sm text-muted-foreground">Prüfe auf action_required Tags</p>
              </div>
              <Switch
                id="poll-action"
                checked={pollingData.pollActionEnabled}
                onCheckedChange={(checked) => setPollingData({ ...pollingData, pollActionEnabled: checked })}
              />
            </div>
            {pollingData.pollActionEnabled && (
              <div>
                <Label htmlFor="poll-action-interval">Intervall (Minuten)</Label>
                <Input
                  id="poll-action-interval"
                  type="number"
                  value={pollingData.pollActionInterval}
                  onChange={(e) => setPollingData({ ...pollingData, pollActionInterval: e.target.value })}
                />
              </div>
            )}

            {/* AI Todo Polling */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label htmlFor="poll-ai-todo" className="text-base">AI Todo Polling</Label>
                <p className="text-sm text-muted-foreground">Prüfe auf ai_todo Tags</p>
              </div>
              <Switch
                id="poll-ai-todo"
                checked={pollingData.pollAiTodoEnabled}
                onCheckedChange={(checked) => setPollingData({ ...pollingData, pollAiTodoEnabled: checked })}
              />
            </div>
            {pollingData.pollAiTodoEnabled && (
              <div>
                <Label htmlFor="poll-ai-todo-interval">Intervall (Minuten)</Label>
                <Input
                  id="poll-ai-todo-interval"
                  type="number"
                  value={pollingData.pollAiTodoInterval}
                  onChange={(e) => setPollingData({ ...pollingData, pollAiTodoInterval: e.target.value })}
                />
              </div>
            )}
          </div>
          <Button onClick={savePolling}>
            <FontAwesomeIcon icon={faSave} className="mr-2" />
            Speichern
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
