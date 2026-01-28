"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle,
  faSpinner,
  faExclamationTriangle,
  faRedo,
  faEye,
  faEyeSlash
} from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';
import FTPSettingsCard from './FTPSettingsCard';
import EmailSettingsCard from './EmailSettingsCard';
import GoogleOAuthSettingsCard from './GoogleOAuthSettingsCard';

interface SettingsTabProps {
  initialData?: Record<string, any>;
}

export default function SettingsTab({ initialData = {} }: SettingsTabProps) {
  const router = useRouter();
  const { toast } = useToast();

  // State for each section
  const [paperlessData, setPaperlessData] = useState({
    url: initialData.paperlessUrl || '',
    token: initialData.paperlessToken || '',
    tested: false,
  });
  const [showPaperlessToken, setShowPaperlessToken] = useState(false);

  const [geminiData, setGeminiData] = useState({
    apiKey: initialData.geminiApiKey || '',
    model: initialData.geminiModel || 'gemini-1.5-flash',
    tested: false,
  });
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  const [documentAIData, setDocumentAIData] = useState({
    projectId: initialData.projectId || '',
    credentials: initialData.credentials || '',
    processorId: initialData.processorId || '',
    location: initialData.location || 'us',
    tested: false,
  });
  const [showDocAICreds, setShowDocAICreds] = useState(false);

  const [oauthData, setOAuthData] = useState({
    clientId: initialData.clientId || '',
    clientSecret: initialData.clientSecret || '',
    calendarId: initialData.calendarId || '',
    taskListId: initialData.taskListId || '',
    tested: false,
  });
  const [showOAuthSecret, setShowOAuthSecret] = useState(false);

  const [emailData, setEmailData] = useState({
    enabled: initialData.emailEnabled || false,
    smtpServer: initialData.smtpServer || '',
    smtpPort: initialData.smtpPort || '587',
    smtpEncryption: initialData.smtpEncryption || 'STARTTLS',
    smtpUser: initialData.smtpUser || '',
    smtpPassword: initialData.smtpPassword || '',
    emailSender: initialData.emailSender || '',
    emailRecipients: initialData.emailRecipients || '',
    tested: false,
  });
  const [showEmailPassword, setShowEmailPassword] = useState(false);

  const [ftpData, setFtpData] = useState({
    enabled: initialData.ftpEnabled || false,
    username: initialData.ftpUsername || 'paiperless',
    password: initialData.ftpPassword || '',
    port: initialData.ftpPort || '21',
    enableTls: initialData.ftpEnableTls || false,
    pasvUrl: initialData.ftpPasvUrl || '',
    tested: false,
  });
  const [showFtpPassword, setShowFtpPassword] = useState(false);

  const [advancedData, setAdvancedData] = useState({
    pollConsumeEnabled: initialData.pollConsumeEnabled || false,
    pollConsumeInterval: initialData.pollConsumeInterval || '10',
    pollActionEnabled: initialData.pollActionEnabled || false,
    pollActionInterval: initialData.pollActionInterval || '30',
    pollAiTodoEnabled: initialData.pollAiTodoEnabled || false,
    pollAiTodoInterval: initialData.pollAiTodoInterval || '30',
  });

  const [integrationData, setIntegrationData] = useState({
    tagAiTodo: initialData.tagAiTodo || 'ai_todo',
    tagActionRequired: initialData.tagActionRequired || 'action_required',
    fieldActionDescription: initialData.fieldActionDescription || 'action_description',
    fieldDueDate: initialData.fieldDueDate || 'due_date',
  });

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResettingSetup, setIsResettingSetup] = useState(false);
  const [isRestartingServices, setIsRestartingServices] = useState(false);

  // Helper function to restart services after configuration changes
  const restartServices = async (serviceName: 'ftp' | 'worker' | 'all' = 'all') => {
    setIsRestartingServices(true);

    toast({
      title: 'Services werden neugestartet...',
      description: 'Bitte warten Sie einen Moment.',
    });

    try {
      const response = await fetch('/api/services/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: serviceName }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: 'Services neugestartet',
          description: result.message || 'Alle Services laufen mit den neuen Einstellungen.',
          variant: 'success',
        });
      } else {
        toast({
          title: 'Neustart teilweise fehlgeschlagen',
          description: result.message || 'Einige Services konnten nicht neugestartet werden.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Fehler beim Neustart',
        description: 'Services konnten nicht neugestartet werden.',
        variant: 'destructive',
      });
    } finally {
      setIsRestartingServices(false);
    }
  };

  // Test functions
  const testPaperless = async () => {
    if (!paperlessData.url || !paperlessData.token) {
      toast({
        title: 'Fehler',
        description: 'Bitte URL und Token angeben',
        variant: 'destructive',
      });
      return;
    }

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
    }
  };

  const savePaperless = async () => {
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
    }
  };

  const testGemini = async () => {
    if (!geminiData.apiKey) {
      toast({
        title: 'Fehler',
        description: 'Bitte API Key angeben',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('/api/setup/test-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiApiKey: geminiData.apiKey,
          geminiModel: geminiData.model,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setGeminiData({ ...geminiData, tested: true });
        toast({
          title: 'Test erfolgreich',
          description: 'Gemini API ist funktionsfähig',
          variant: 'success',
        });
      } else {
        toast({
          title: 'Test fehlgeschlagen',
          description: result.error || 'Fehler beim Testen',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Test fehlgeschlagen',
        description: 'Netzwerkfehler',
        variant: 'destructive',
      });
    }
  };

  const saveGemini = async () => {
    try {
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 2,
          data: {
            geminiApiKey: geminiData.apiKey,
            geminiModel: geminiData.model,
          },
        }),
      });

      toast({
        title: 'Gespeichert',
        description: 'Gemini AI Einstellungen gespeichert',
        variant: 'success',
      });

      setGeminiData({ ...geminiData, tested: false });
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Konnte nicht speichern',
        variant: 'destructive',
      });
    }
  };

  const testDocumentAI = async () => {
    if (!documentAIData.projectId || !documentAIData.processorId || !documentAIData.credentials) {
      toast({
        title: 'Fehler',
        description: 'Bitte alle Felder ausfüllen',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('/api/setup/test-document-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...documentAIData,
          testType: 'connection', // Test connection only (faster than OCR test)
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setDocumentAIData({ ...documentAIData, tested: true });
        toast({
          title: 'Test erfolgreich',
          description: 'Document AI Verbindung erfolgreich',
          variant: 'success',
        });
      } else {
        toast({
          title: 'Test fehlgeschlagen',
          description: result.error || 'Fehler beim Testen',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Test fehlgeschlagen',
        description: 'Netzwerkfehler',
        variant: 'destructive',
      });
    }
  };

  const saveDocumentAI = async () => {
    try {
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 3,
          data: documentAIData,
        }),
      });

      toast({
        title: 'Gespeichert',
        description: 'Document AI Einstellungen gespeichert',
        variant: 'success',
      });

      setDocumentAIData({ ...documentAIData, tested: false });
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Konnte nicht speichern',
        variant: 'destructive',
      });
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
        title: 'Gespeichert',
        description: 'Paperless Integration Einstellungen gespeichert',
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

  const saveAdvanced = async () => {
    try {
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 7,
          data: advancedData,
        }),
      });

      toast({
        title: 'Gespeichert',
        description: 'Erweiterte Einstellungen gespeichert',
        variant: 'success',
      });

      // Restart services to apply new polling configuration
      await restartServices('all');
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Konnte nicht speichern',
        variant: 'destructive',
      });
    }
  };

  const handleResetSetup = async () => {
    setIsResettingSetup(true);
    try {
      const response = await fetch('/api/setup/reset', {
        method: 'POST',
      });

      if (response.ok) {
        toast({
          title: "Setup zurückgesetzt",
          description: "Sie werden zum Setup-Wizard weitergeleitet...",
        });

        setTimeout(() => {
          router.push('/setup');
        }, 1500);
      } else {
        throw new Error('Failed to reset setup');
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Setup konnte nicht zurückgesetzt werden.",
        variant: "destructive",
      });
      setIsResettingSetup(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Einstellungen</h2>
        <p className="text-sm text-muted-foreground">
          Verwalten Sie Ihre pAIperless Konfiguration
        </p>
      </div>

      {/* Paperless-NGX Section */}
      <Card>
        <CardHeader>
          <CardTitle>Paperless-NGX</CardTitle>
          <CardDescription>Verbindung zu Ihrer Paperless-NGX Instanz</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="paperless-url">Paperless URL</Label>
            <Input
              id="paperless-url"
              value={paperlessData.url}
              onChange={(e) => {
                setPaperlessData({ ...paperlessData, url: e.target.value, tested: false });
              }}
              placeholder="http://paperless:8000"
            />
          </div>
          <div>
            <Label htmlFor="paperless-token">API Token</Label>
            <div className="flex gap-2">
              <Input
                id="paperless-token"
                type={showPaperlessToken ? 'text' : 'password'}
                value={paperlessData.token}
                onChange={(e) => {
                  setPaperlessData({ ...paperlessData, token: e.target.value, tested: false });
                }}
                placeholder="Token von Paperless-NGX"
              />
              <Button
                variant="outline"
                onClick={() => setShowPaperlessToken(!showPaperlessToken)}
                size="icon"
              >
                <FontAwesomeIcon icon={showPaperlessToken ? faEyeSlash : faEye} />
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={testPaperless} variant="outline">
              <FontAwesomeIcon icon={faCheckCircle} className="mr-2" />
              Verbindung testen
            </Button>
            <Button
              onClick={savePaperless}
              disabled={!paperlessData.tested}
              className={cn(!paperlessData.tested && 'opacity-50 cursor-not-allowed')}
            >
              Speichern
            </Button>
            {paperlessData.tested && (
              <span className="flex items-center text-sm text-green-600">
                <FontAwesomeIcon icon={faCheckCircle} className="mr-2" />
                Getestet
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gemini AI Section */}
      <Card>
        <CardHeader>
          <CardTitle>Gemini AI</CardTitle>
          <CardDescription>Google Gemini für intelligentes Tagging</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="gemini-key">API Key</Label>
            <div className="flex gap-2">
              <Input
                id="gemini-key"
                type={showGeminiKey ? 'text' : 'password'}
                value={geminiData.apiKey}
                onChange={(e) => {
                  setGeminiData({ ...geminiData, apiKey: e.target.value, tested: false });
                }}
                placeholder="AIza..."
              />
              <Button
                variant="outline"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                size="icon"
              >
                <FontAwesomeIcon icon={showGeminiKey ? faEyeSlash : faEye} />
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="gemini-model">Modell</Label>
            <Input
              id="gemini-model"
              value={geminiData.model}
              onChange={(e) => {
                setGeminiData({ ...geminiData, model: e.target.value, tested: false });
              }}
              placeholder="gemini-1.5-flash"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={testGemini} variant="outline">
              <FontAwesomeIcon icon={faCheckCircle} className="mr-2" />
              API testen
            </Button>
            <Button
              onClick={saveGemini}
              disabled={!geminiData.tested}
              className={cn(!geminiData.tested && 'opacity-50 cursor-not-allowed')}
            >
              Speichern
            </Button>
            {geminiData.tested && (
              <span className="flex items-center text-sm text-green-600">
                <FontAwesomeIcon icon={faCheckCircle} className="mr-2" />
                Getestet
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Document AI Section */}
      <Card>
        <CardHeader>
          <CardTitle>Google Cloud Document AI</CardTitle>
          <CardDescription>OCR für Dokumentenverarbeitung</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="doc-ai-project">Project ID</Label>
            <Input
              id="doc-ai-project"
              value={documentAIData.projectId}
              onChange={(e) => {
                setDocumentAIData({ ...documentAIData, projectId: e.target.value, tested: false });
              }}
              placeholder="mein-projekt"
            />
          </div>
          <div>
            <Label htmlFor="doc-ai-processor">Processor ID</Label>
            <Input
              id="doc-ai-processor"
              value={documentAIData.processorId}
              onChange={(e) => {
                setDocumentAIData({ ...documentAIData, processorId: e.target.value, tested: false });
              }}
              placeholder="abc123..."
            />
          </div>
          <div>
            <Label htmlFor="doc-ai-location">Location</Label>
            <Input
              id="doc-ai-location"
              value={documentAIData.location}
              onChange={(e) => {
                setDocumentAIData({ ...documentAIData, location: e.target.value, tested: false });
              }}
              placeholder="us or eu"
            />
          </div>
          <div>
            <Label htmlFor="doc-ai-creds">Service Account Credentials (JSON)</Label>
            <div className="flex gap-2">
              <textarea
                id="doc-ai-creds"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                value={documentAIData.credentials}
                onChange={(e) => {
                  setDocumentAIData({ ...documentAIData, credentials: e.target.value, tested: false });
                }}
                placeholder='{"type": "service_account", ...}'
                style={{ display: showDocAICreds ? 'block' : 'none' }}
              />
              {!showDocAICreds && (
                <div className="flex-1 p-2 border rounded bg-gray-50 dark:bg-gray-900 text-sm text-muted-foreground">
                  ••• Service Account JSON versteckt
                </div>
              )}
              <Button
                variant="outline"
                onClick={() => setShowDocAICreds(!showDocAICreds)}
                size="icon"
              >
                <FontAwesomeIcon icon={showDocAICreds ? faEyeSlash : faEye} />
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={testDocumentAI} variant="outline">
              <FontAwesomeIcon icon={faCheckCircle} className="mr-2" />
              Mit test.pdf testen
            </Button>
            <Button
              onClick={saveDocumentAI}
              disabled={!documentAIData.tested}
              className={cn(!documentAIData.tested && 'opacity-50 cursor-not-allowed')}
            >
              Speichern
            </Button>
            {documentAIData.tested && (
              <span className="flex items-center text-sm text-green-600">
                <FontAwesomeIcon icon={faCheckCircle} className="mr-2" />
                Getestet
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Paperless Integration Section */}
      <Card>
        <CardHeader>
          <CardTitle>Paperless Integration</CardTitle>
          <CardDescription>Tags und Custom Fields</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tag-ai-todo">AI Todo Tag</Label>
              <Input
                id="tag-ai-todo"
                value={integrationData.tagAiTodo}
                onChange={(e) => {
                  setIntegrationData({ ...integrationData, tagAiTodo: e.target.value });
                }}
                placeholder="ai_todo"
              />
            </div>
            <div>
              <Label htmlFor="tag-action">Action Required Tag</Label>
              <Input
                id="tag-action"
                value={integrationData.tagActionRequired}
                onChange={(e) => {
                  setIntegrationData({ ...integrationData, tagActionRequired: e.target.value });
                }}
                placeholder="action_required"
              />
            </div>
            <div>
              <Label htmlFor="field-action">Action Description Field</Label>
              <Input
                id="field-action"
                value={integrationData.fieldActionDescription}
                onChange={(e) => {
                  setIntegrationData({ ...integrationData, fieldActionDescription: e.target.value });
                }}
                placeholder="action_description"
              />
            </div>
            <div>
              <Label htmlFor="field-due">Due Date Field</Label>
              <Input
                id="field-due"
                value={integrationData.fieldDueDate}
                onChange={(e) => {
                  setIntegrationData({ ...integrationData, fieldDueDate: e.target.value });
                }}
                placeholder="due_date"
              />
            </div>
          </div>
          <Button onClick={saveIntegration}>
            Speichern
          </Button>
        </CardContent>
      </Card>

      {/* Google OAuth Section */}
      <GoogleOAuthSettingsCard
        initialData={{
          clientId: oauthData.clientId,
          clientSecret: oauthData.clientSecret,
          calendarId: oauthData.calendarId,
          taskListId: oauthData.taskListId,
        }}
      />

      {/* FTP Server Section */}
      <FTPSettingsCard
        initialData={{
          enabled: ftpData.enabled,
          username: ftpData.username,
          password: ftpData.password,
          port: ftpData.port,
          enableTls: ftpData.enableTls,
          pasvUrl: ftpData.pasvUrl,
        }}
        onServiceRestart={restartServices}
      />

      {/* Email Notifications Section */}
      <EmailSettingsCard
        initialData={{
          enabled: emailData.enabled,
          smtpServer: emailData.smtpServer,
          smtpPort: emailData.smtpPort,
          smtpEncryption: emailData.smtpEncryption,
          smtpUser: emailData.smtpUser,
          smtpPassword: emailData.smtpPassword,
          emailSender: emailData.emailSender,
          emailRecipients: emailData.emailRecipients,
        }}
      />

      {/* Advanced Settings Section */}
      <Card>
        <CardHeader>
          <CardTitle>Erweiterte Einstellungen</CardTitle>
          <CardDescription>Polling-Intervalle und Worker-Konfiguration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="poll-consume">Consume Folder Polling</Label>
              <Switch
                id="poll-consume"
                checked={advancedData.pollConsumeEnabled}
                onCheckedChange={(checked) => {
                  setAdvancedData({ ...advancedData, pollConsumeEnabled: checked });
                }}
              />
            </div>
            {advancedData.pollConsumeEnabled && (
              <div>
                <Label htmlFor="poll-consume-interval">Intervall (Sekunden)</Label>
                <Input
                  id="poll-consume-interval"
                  type="number"
                  value={advancedData.pollConsumeInterval}
                  onChange={(e) => {
                    setAdvancedData({ ...advancedData, pollConsumeInterval: e.target.value });
                  }}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor="poll-action">Action Required Polling</Label>
              <Switch
                id="poll-action"
                checked={advancedData.pollActionEnabled}
                onCheckedChange={(checked) => {
                  setAdvancedData({ ...advancedData, pollActionEnabled: checked });
                }}
              />
            </div>
            {advancedData.pollActionEnabled && (
              <div>
                <Label htmlFor="poll-action-interval">Intervall (Sekunden)</Label>
                <Input
                  id="poll-action-interval"
                  type="number"
                  value={advancedData.pollActionInterval}
                  onChange={(e) => {
                    setAdvancedData({ ...advancedData, pollActionInterval: e.target.value });
                  }}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor="poll-ai-todo">AI Todo Polling</Label>
              <Switch
                id="poll-ai-todo"
                checked={advancedData.pollAiTodoEnabled}
                onCheckedChange={(checked) => {
                  setAdvancedData({ ...advancedData, pollAiTodoEnabled: checked });
                }}
              />
            </div>
            {advancedData.pollAiTodoEnabled && (
              <div>
                <Label htmlFor="poll-ai-todo-interval">Intervall (Sekunden)</Label>
                <Input
                  id="poll-ai-todo-interval"
                  type="number"
                  value={advancedData.pollAiTodoInterval}
                  onChange={(e) => {
                    setAdvancedData({ ...advancedData, pollAiTodoInterval: e.target.value });
                  }}
                />
              </div>
            )}
          </div>
          <Button onClick={saveAdvanced}>
            Speichern
          </Button>
        </CardContent>
      </Card>

      {/* Setup Reset Section */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Wizard</CardTitle>
          <CardDescription>Setup-Wizard erneut ausführen</CardDescription>
        </CardHeader>
        <CardContent>
          {!showResetConfirm ? (
            <Button
              variant="outline"
              onClick={() => setShowResetConfirm(true)}
              disabled={isResettingSetup}
            >
              <FontAwesomeIcon icon={faRedo} className="mr-2" />
              Setup erneut ausführen
            </Button>
          ) : (
            <div className="p-4 border border-yellow-500 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
              <div className="flex items-start gap-3 mb-4">
                <FontAwesomeIcon
                  icon={faExclamationTriangle}
                  className="text-yellow-600 text-xl mt-1"
                />
                <div>
                  <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                    Setup zurücksetzen?
                  </h3>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                    Dies setzt die Setup-Konfiguration zurück und leitet Sie zum Setup-Wizard weiter.
                    <strong className="block mt-1">Ihre vorhandenen Einstellungen bleiben erhalten</strong> und
                    werden im Wizard vorausgefüllt.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleResetSetup}
                      disabled={isResettingSetup}
                      size="sm"
                    >
                      {isResettingSetup ? 'Wird zurückgesetzt...' : 'Ja, Setup starten'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowResetConfirm(false)}
                      disabled={isResettingSetup}
                      size="sm"
                    >
                      Abbrechen
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
