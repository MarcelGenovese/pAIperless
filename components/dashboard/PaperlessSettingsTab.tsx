"use client"

import { useTranslations } from 'next-intl';
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
    tagAiTodo?: string;
    tagActionRequired?: string;
    fieldActionDescription?: string;
    fieldDueDate?: string;
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

  const [integrationData, setIntegrationData] = useState({
    tagAiTodo: initialData.tagAiTodo || 'ai_todo',
    tagActionRequired: initialData.tagActionRequired || 'action_required',
    fieldActionDescription: initialData.fieldActionDescription || 'action_description',
    fieldDueDate: initialData.fieldDueDate || 'due_date',
  });

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
        title: t('status.error'),
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
        title: t('saved'),
        description: 'Paperless-NGX Einstellungen gespeichert',
        variant: 'success',
      });

      setPaperlessData({ ...paperlessData, tested: false });
    } catch (error) {
      toast({
        title: t('status.error'),
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
          title: t('status.error'),
          description: result.error || 'Konnte OCR-Einstellungen nicht prüfen',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: t('status.error'),
        description: 'Netzwerkfehler beim Prüfen der OCR-Einstellungen',
        variant: 'destructive',
      });
    } finally {
      setCheckingOCR(false);
    }
  };

  const saveIntegration = async () => {
    try {
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 6,
          data: integrationData,
        }),
      });

      toast({
        title: t('saved'),
        description: 'Integration Einstellungen gespeichert',
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: t('status.error'),
        description: 'Konnte nicht speichern',
        variant: 'destructive',
      });
    }
  };

  const savePolling = async () => {
    try {
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 7,
          data: pollingData,
        }),
      });

      toast({
        title: t('saved'),
        description: 'Polling Einstellungen gespeichert',
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: t('status.error'),
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
              {saving ? 'Speichert...' : t('save')}
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

      {/* Integration Tags & Fields */}
      <Card>
        <CardHeader>
          <CardTitle>Paperless Integration</CardTitle>
          <CardDescription>Tags und Custom Fields für die Dokumentenverarbeitung</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tag-ai-todo">AI Todo Tag</Label>
              <Input
                id="tag-ai-todo"
                value={integrationData.tagAiTodo}
                onChange={(e) => setIntegrationData({ ...integrationData, tagAiTodo: e.target.value })}
                placeholder="ai_todo"
              />
            </div>
            <div>
              <Label htmlFor="tag-action">Action Required Tag</Label>
              <Input
                id="tag-action"
                value={integrationData.tagActionRequired}
                onChange={(e) => setIntegrationData({ ...integrationData, tagActionRequired: e.target.value })}
                placeholder="action_required"
              />
            </div>
            <div>
              <Label htmlFor="field-action">Action Description Field</Label>
              <Input
                id="field-action"
                value={integrationData.fieldActionDescription}
                onChange={(e) => setIntegrationData({ ...integrationData, fieldActionDescription: e.target.value })}
                placeholder="action_description"
              />
            </div>
            <div>
              <Label htmlFor="field-due">Due Date Field</Label>
              <Input
                id="field-due"
                value={integrationData.fieldDueDate}
                onChange={(e) => setIntegrationData({ ...integrationData, fieldDueDate: e.target.value })}
                placeholder="due_date"
              />
            </div>
          </div>
          <Button onClick={saveIntegration}>
            <FontAwesomeIcon icon={faSave} className="mr-2" />
            Speichern
          </Button>
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
