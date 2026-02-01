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
  faTrash,
  faBroom,
  faExclamationCircle,
} from '@fortawesome/free-solid-svg-icons';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useTranslations } from 'next-intl';


export default function AdvancedSettingsTab() {
  const t = useTranslations('settings');

  const router = useRouter();
  const { toast } = useToast();

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResettingSetup, setIsResettingSetup] = useState(false);

  // Maintenance State
  const [showClearFoldersConfirm, setShowClearFoldersConfirm] = useState(false);
  const [showClearPendingConfirm, setShowClearPendingConfirm] = useState(false);
  const [showFullResetConfirm, setShowFullResetConfirm] = useState(false);
  const [isClearingFolders, setIsClearingFolders] = useState(false);
  const [isClearingPending, setIsClearingPending] = useState(false);
  const [isFullReset, setIsFullReset] = useState(false);

  // Language State
  const [currentLanguage, setCurrentLanguage] = useState('de');
  const [isLoadingLanguage, setIsLoadingLanguage] = useState(true);
  const [isSavingLanguage, setIsSavingLanguage] = useState(false);

  // Dark Mode State
  const [darkMode, setDarkMode] = useState(false);
  const [isLoadingDarkMode, setIsLoadingDarkMode] = useState(true);
  const [isSavingDarkMode, setIsSavingDarkMode] = useState(false);

  // Prompt Template State
  const [promptTemplate, setPromptTemplate] = useState('');
  const [initialPromptTemplate, setInitialPromptTemplate] = useState('');
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(true);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [isRestoringDefault, setIsRestoringDefault] = useState(false);

  // Version State
  const [version, setVersion] = useState<string>('');

  // Load language, dark mode, prompt template and version on mount
  useEffect(() => {
    loadLanguage();
    loadDarkMode();
    loadPromptTemplate();
    loadVersion();
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

  const loadDarkMode = async () => {
    setIsLoadingDarkMode(true);
    try {
      const response = await fetch('/api/setup/load-config?step=0');
      if (response.ok) {
        const data = await response.json();
        const isDark = data.darkMode === 'true';
        setDarkMode(isDark);
        // Apply dark mode class to document
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    } catch (error) {
      console.error('Failed to load dark mode:', error);
    } finally {
      setIsLoadingDarkMode(false);
    }
  };

  const handleDarkModeChange = async (checked: boolean) => {
    setIsSavingDarkMode(true);
    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 0,
          data: { darkMode: checked ? 'true' : 'false' }
        }),
      });

      if (response.ok) {
        setDarkMode(checked);
        // Apply dark mode class to document
        if (checked) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        toast({
          title: 'Design gespeichert',
          description: checked ? 'Dark Mode aktiviert' : 'Light Mode aktiviert',
          variant: 'success',
        });
      } else {
        throw new Error('Failed to save dark mode');
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Konnte Design nicht speichern',
        variant: 'destructive',
      });
    } finally {
      setIsSavingDarkMode(false);
    }
  };

  const loadVersion = async () => {
    try {
      const response = await fetch('/api/version');
      if (response.ok) {
        const data = await response.json();
        setVersion(data.version || 'unknown');
      }
    } catch (error) {
      console.error('Failed to load version:', error);
      setVersion('unknown');
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

  const handleClearFolders = async () => {
    setIsClearingFolders(true);
    try {
      const response = await fetch('/api/maintenance/clear-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folders: ['consume', 'processing', 'error', 'completed'] }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Ordner bereinigt',
          description: data.message,
          variant: 'success',
        });
        setShowClearFoldersConfirm(false);
      } else {
        throw new Error(data.error || 'Failed to clear folders');
      }
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: error.message || 'Ordner konnten nicht bereinigt werden',
        variant: 'destructive',
      });
    } finally {
      setIsClearingFolders(false);
    }
  };

  const handleClearPending = async () => {
    setIsClearingPending(true);
    try {
      const response = await fetch('/api/maintenance/clear-pending', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Ausstehende Dokumente bereinigt',
          description: data.message,
          variant: 'success',
        });
        setShowClearPendingConfirm(false);
      } else {
        throw new Error(data.error || 'Failed to clear pending');
      }
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: error.message || 'Bereinigung fehlgeschlagen',
        variant: 'destructive',
      });
    } finally {
      setIsClearingPending(false);
    }
  };

  const handleFullReset = async () => {
    setIsFullReset(true);
    try {
      const response = await fetch('/api/maintenance/full-reset', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Komplette Bereinigung abgeschlossen',
          description: data.message,
          variant: 'success',
        });
        setShowFullResetConfirm(false);

        // Reload page after short delay
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        throw new Error(data.error || 'Failed to reset');
      }
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: error.message || 'Komplette Bereinigung fehlgeschlagen',
        variant: 'destructive',
      });
    } finally {
      setIsFullReset(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Setup Wizard Reset */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Wizard</CardTitle>
          <CardDescription>{t('setup_wizard_erneut_ausfuehren')}</CardDescription>
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
            <div className="p-4 border border-yellow-500 dark:border-yellow-600 rounded-lg bg-yellow-50 dark:bg-[hsl(45,40%,15%)]">
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
          <CardDescription>{t('aendern_sie_die_anzeigesprache_der_anwendung')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Label htmlFor="language-select">{t('selectLanguage')}</Label>
            <Select
              value={currentLanguage}
              onValueChange={handleLanguageChange}
              disabled={isLoadingLanguage || isSavingLanguage}
            >
              <SelectTrigger id="language-select" className="w-[280px]">
                <SelectValue placeholder={t('sprache_waehlen')} />
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

      {/* Dark Mode */}
      <Card>
        <CardHeader>
          <CardTitle>Design</CardTitle>
          <CardDescription>{t('waehlen_sie_zwischen_hellem_und_dunklem_design')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="dark-mode-switch">Dark Mode</Label>
              <p className="text-sm text-muted-foreground">
                Aktivieren Sie das dunkle Design
              </p>
            </div>
            <Switch
              id="dark-mode-switch"
              checked={darkMode}
              onCheckedChange={handleDarkModeChange}
              disabled={isLoadingDarkMode || isSavingDarkMode}
            />
          </div>
          {isSavingDarkMode && (
            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-3">
              <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
              Speichert...
            </p>
          )}
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
          <CardDescription>{t('diagnose_und_technische_details')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600 dark:text-gray-400">Version</span>
              <span className="font-medium font-mono">{version || 'loading...'}</span>
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
          <CardDescription>{t('system_zustand_und_empfehlungen')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-[hsl(0,0%,15%)] border border-blue-200 dark:border-[hsl(0,0%,25%)] rounded-lg">
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

            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-[hsl(0,0%,15%)] border border-blue-200 dark:border-[hsl(0,0%,25%)] rounded-lg">
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

            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-[hsl(0,0%,15%)] border border-blue-200 dark:border-[hsl(0,0%,25%)] rounded-lg">
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

      {/* Data Maintenance */}
      <Card>
        <CardHeader>
          <CardTitle>Datenbereinigung</CardTitle>
          <CardDescription>{t('bereinigen_sie_ordner_und_datenbank_von_alten_auss')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Clear Folders */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold mb-1">Ordner bereinigen</h3>
                  <p className="text-sm text-muted-foreground">
                    Löscht alle Dateien aus Consume, Processing, Error und Completed Ordnern
                  </p>
                </div>
              </div>
              {!showClearFoldersConfirm ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClearFoldersConfirm(true)}
                  disabled={isClearingFolders}
                >
                  <FontAwesomeIcon icon={faBroom} className="mr-2" />
                  Ordner bereinigen
                </Button>
              ) : (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded">
                  <div className="flex items-start gap-2 mb-3">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-600 mt-0.5" />
                    <p className="text-sm text-yellow-900 dark:text-yellow-100">
                      Alle Dateien in den Ordnern werden gelöscht. Diese Aktion kann nicht rückgängig gemacht werden!
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleClearFolders}
                      disabled={isClearingFolders}
                    >
                      {isClearingFolders ? 'Bereinige...' : 'Ja, bereinigen'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowClearFoldersConfirm(false)}
                      disabled={isClearingFolders}
                    >
                      Abbrechen
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Clear Pending Documents */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold mb-1">Ausstehende Dokumente bereinigen</h3>
                  <p className="text-sm text-muted-foreground">
                    Löscht Dokumente aus der Datenbank mit Status PENDING, PREPROCESSING, OCR_IN_PROGRESS, etc.
                  </p>
                </div>
              </div>
              {!showClearPendingConfirm ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClearPendingConfirm(true)}
                  disabled={isClearingPending}
                >
                  <FontAwesomeIcon icon={faTrash} className="mr-2" />
                  Ausstehende bereinigen
                </Button>
              ) : (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded">
                  <div className="flex items-start gap-2 mb-3">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-600 mt-0.5" />
                    <p className="text-sm text-yellow-900 dark:text-yellow-100">
                      Alle ausstehenden Dokumente werden aus der Datenbank gelöscht.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleClearPending}
                      disabled={isClearingPending}
                    >
                      {isClearingPending ? 'Bereinige...' : 'Ja, bereinigen'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowClearPendingConfirm(false)}
                      disabled={isClearingPending}
                    >
                      Abbrechen
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Full Reset */}
            <div className="p-4 border-2 border-red-200 dark:border-red-900 rounded-lg bg-red-50 dark:bg-red-950/20">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">
                    <FontAwesomeIcon icon={faExclamationCircle} className="mr-2" />
                    Komplette Bereinigung
                  </h3>
                  <p className="text-sm text-red-800 dark:text-red-200">
                    <strong>ACHTUNG:</strong> Löscht ALLE Dokumenten-Historie, Hashes und Dateien aus allen Ordnern.
                    Die Dokumentenverarbeitung wird komplett auf Null gesetzt.
                  </p>
                </div>
              </div>
              {!showFullResetConfirm ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowFullResetConfirm(true)}
                  disabled={isFullReset}
                >
                  <FontAwesomeIcon icon={faExclamationCircle} className="mr-2" />
                  Alles zurücksetzen
                </Button>
              ) : (
                <div className="p-3 bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded">
                  <div className="flex items-start gap-2 mb-3">
                    <FontAwesomeIcon icon={faExclamationCircle} className="text-red-600 mt-0.5" />
                    <div className="text-sm text-red-900 dark:text-red-100">
                      <p className="font-semibold mb-1">Sind Sie ABSOLUT sicher?</p>
                      <p>{t('dies_wird_loeschen')}</p>
                      <ul className="list-disc list-inside mt-1">
                        <li>{t('alle_dokumente_aus_der_datenbank')}</li>
                        <li>{t('alle_hashes_duplikatschutz_wird_zurueckgesetzt')}</li>
                        <li>Alle Dateien aus allen Ordnern</li>
                        <li>Alle dokumentbezogenen Logs</li>
                      </ul>
                      <p className="mt-2 font-semibold">{t('diese_aktion_kann_nicht_rueckgaengig_gemacht_werde')}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleFullReset}
                      disabled={isFullReset}
                    >
                      {isFullReset ? 'Bereinige...' : 'Ja, ALLES löschen'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFullResetConfirm(false)}
                      disabled={isFullReset}
                    >
                      Abbrechen
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs and Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle>Logs & Fehlerbehebung</CardTitle>
          <CardDescription>{t('zugriff_auf_system_logs_und_debugging_informatione')}</CardDescription>
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
