"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRedo,
  faExclamationTriangle,
  faInfoCircle,
  faSave,
  faRotateLeft,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AdvancedSettingsTab() {
  const router = useRouter();
  const { toast } = useToast();

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResettingSetup, setIsResettingSetup] = useState(false);

  // Language State
  const [currentLanguage, setCurrentLanguage] = useState('de');
  const [isLoadingLanguage, setIsLoadingLanguage] = useState(true);
  const [isSavingLanguage, setIsSavingLanguage] = useState(false);

  // Prompt Template State
  const [promptTemplate, setPromptTemplate] = useState('');
  const [initialPromptTemplate, setInitialPromptTemplate] = useState('');
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(true);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [isRestoringDefault, setIsRestoringDefault] = useState(false);

  // Load language and prompt template on mount
  useEffect(() => {
    loadLanguage();
    loadPromptTemplate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLanguage = async () => {
    setIsLoadingLanguage(true);
    try {
      const response = await fetch('/api/setup/load-config?step=0');
      if (response.ok) {
        const data = await response.json();
        setCurrentLanguage(data.locale || 'de');
      }
    } catch (error) {
      console.error('Failed to load language:', error);
    } finally {
      setIsLoadingLanguage(false);
    }
  };

  const handleLanguageChange = async (language: string) => {
    setIsSavingLanguage(true);
    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 0,
          data: { locale: language }
        }),
      });

      if (response.ok) {
        setCurrentLanguage(language);
        toast({
          title: 'Sprache gespeichert',
          description: 'Die Seite wird neu geladen...',
          variant: 'success',
        });

        // Reload page after short delay to apply new language
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        throw new Error('Failed to save language');
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Konnte Sprache nicht speichern',
        variant: 'destructive',
      });
    } finally {
      setIsSavingLanguage(false);
    }
  };

  const loadPromptTemplate = async () => {
    setIsLoadingPrompt(true);
    try {
      const response = await fetch('/api/config/prompt-template');
      if (response.ok) {
        const data = await response.json();
        setPromptTemplate(data.template || '');
        setInitialPromptTemplate(data.template || '');
      }
    } catch (error) {
      console.error('Failed to load prompt template:', error);
    } finally {
      setIsLoadingPrompt(false);
    }
  };

  const loadDefaultPrompt = async () => {
    setIsRestoringDefault(true);
    try {
      const response = await fetch('/api/config/prompt-template/default');
      if (response.ok) {
        const data = await response.json();
        setPromptTemplate(data.template || '');
        toast({
          title: 'Standard geladen',
          description: 'Der Standard-Prompt wurde geladen',
          variant: 'success',
        });
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Konnte Standard-Prompt nicht laden',
        variant: 'destructive',
      });
    } finally {
      setIsRestoringDefault(false);
    }
  };

  const savePromptTemplate = async () => {
    setIsSavingPrompt(true);
    try {
      const response = await fetch('/api/config/prompt-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: promptTemplate }),
      });

      if (response.ok) {
        setInitialPromptTemplate(promptTemplate);
        toast({
          title: 'Gespeichert',
          description: 'Prompt-Template gespeichert',
          variant: 'success',
        });
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Konnte Prompt-Template nicht speichern',
        variant: 'destructive',
      });
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const hasPromptChanged = () => {
    return promptTemplate !== initialPromptTemplate;
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
      {/* Setup Wizard Reset */}
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

      {/* Language Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Sprache</CardTitle>
          <CardDescription>Ändern Sie die Anzeigesprache der Anwendung</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Label htmlFor="language-select">Sprache auswählen</Label>
            <Select
              value={currentLanguage}
              onValueChange={handleLanguageChange}
              disabled={isLoadingLanguage || isSavingLanguage}
            >
              <SelectTrigger id="language-select" className="w-[280px]">
                <SelectValue placeholder="Sprache wählen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
            {isSavingLanguage && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                Speichert und lädt neu...
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Prompt Template Editor */}
      <Card>
        <CardHeader>
          <CardTitle>Prompt Template</CardTitle>
          <CardDescription>
            Anpassen des Prompts für Gemini AI Dokumentenanalyse. Verwenden Sie {'{{'} DOCUMENT_CONTENT {'}}'} als Platzhalter für den Dokumenteninhalt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="prompt-template">Prompt Template</Label>
            <textarea
              id="prompt-template"
              className="flex min-h-[300px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono mt-2"
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              placeholder="Lade Prompt..."
              disabled={isLoadingPrompt}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Dieser Prompt wird an Gemini AI gesendet, um Dokumente zu analysieren und Metadaten zu extrahieren.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={savePromptTemplate}
              disabled={isSavingPrompt || isRestoringDefault || !hasPromptChanged()}
            >
              <FontAwesomeIcon
                icon={isSavingPrompt ? faSpinner : faSave}
                className={`mr-2 ${isSavingPrompt ? 'animate-spin' : ''}`}
              />
              {isSavingPrompt ? 'Speichert...' : 'Speichern'}
            </Button>
            <Button
              variant="outline"
              onClick={loadDefaultPrompt}
              disabled={isRestoringDefault || isSavingPrompt}
            >
              <FontAwesomeIcon
                icon={isRestoringDefault ? faSpinner : faRotateLeft}
                className={`mr-2 ${isRestoringDefault ? 'animate-spin' : ''}`}
              />
              {isRestoringDefault ? 'Lädt...' : 'Standard wiederherstellen'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle>System Informationen</CardTitle>
          <CardDescription>Diagnose und technische Details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600 dark:text-gray-400">Version</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600 dark:text-gray-400">Database</span>
              <span className="font-medium">SQLite (Prisma ORM)</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600 dark:text-gray-400">Runtime</span>
              <span className="font-medium">Node.js</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600 dark:text-gray-400">Environment</span>
              <span className="font-medium">
                {process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600 dark:text-gray-400">Framework</span>
              <span className="font-medium">Next.js 15+</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diagnostics */}
      <Card>
        <CardHeader>
          <CardTitle>Diagnose</CardTitle>
          <CardDescription>System-Zustand und Empfehlungen</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <FontAwesomeIcon icon={faInfoCircle} className="text-blue-600 text-lg mt-0.5" />
              <div>
                <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-1">
                  Polling vs. Webhooks
                </p>
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  Webhooks sind die bevorzugte Methode für Echtzeit-Benachrichtigungen.
                  Polling sollte nur als Fallback aktiviert werden, wenn Webhooks nicht verfügbar sind.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <FontAwesomeIcon icon={faInfoCircle} className="text-blue-600 text-lg mt-0.5" />
              <div>
                <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-1">
                  Deduplication
                </p>
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  Das System verwendet SHA-256 Hashing zur Erkennung von Duplikaten.
                  Bereits verarbeitete Dateien werden automatisch abgelehnt.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <FontAwesomeIcon icon={faInfoCircle} className="text-blue-600 text-lg mt-0.5" />
              <div>
                <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-1">
                  Cost Optimization
                </p>
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  Document AI und Gemini werden nur für neue, eindeutige Dokumente aufgerufen.
                  Große Dateien (über Limit) werden automatisch übersprungen und verwenden Tesseract OCR.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs and Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle>Logs & Fehlerbehebung</CardTitle>
          <CardDescription>Zugriff auf System-Logs und Debugging-Informationen</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Logs können über die Docker-Konsole eingesehen werden:
            </p>
            <div className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-3 rounded-md font-mono text-xs">
              <code>docker logs -f paiperless</code>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Für Shell-Zugriff auf den Container:
            </p>
            <div className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-3 rounded-md font-mono text-xs">
              <code>docker exec -it paiperless /bin/sh</code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
