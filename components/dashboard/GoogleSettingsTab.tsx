"use client"

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faEye, faEyeSlash, faSpinner, faSave } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';
import GoogleOAuthSettingsCard from './GoogleOAuthSettingsCard';
import { useTranslations } from 'next-intl';


interface GoogleSettingsTabProps {
  initialData?: {
    geminiApiKey?: string;
    geminiModel?: string;
    geminiMonthlyTokenLimit?: string;
    geminiCostAmount?: string;
    geminiTokenUnit?: string;
    projectId?: string;
    credentials?: string;
    processorId?: string;
    location?: string;
    maxPages?: string;
    maxSizeMB?: string;
    documentAIMonthlyPageLimit?: string;
    documentAICostAmount?: string;
    documentAIPageUnit?: string;
    enabled?: string;
    clientId?: string;
    clientSecret?: string;
    calendarId?: string;
    taskListId?: string;
  };
}

export default function GoogleSettingsTab({ initialData = {} }: GoogleSettingsTabProps) {
  const t = useTranslations('settings');

  const { toast } = useToast();

  // Store initial values for comparison
  const [initialGeminiData, setInitialGeminiData] = useState({
    apiKey: initialData.geminiApiKey || '',
    model: initialData.geminiModel || 'gemini-1.5-flash',
    monthlyTokenLimit: initialData.geminiMonthlyTokenLimit || '1000000',
    costAmount: initialData.geminiCostAmount || '0.35',
    tokenUnit: initialData.geminiTokenUnit || '1000000',
  });

  // Gemini AI State
  const [geminiData, setGeminiData] = useState({
    apiKey: initialData.geminiApiKey || '',
    model: initialData.geminiModel || 'gemini-1.5-flash',
    monthlyTokenLimit: initialData.geminiMonthlyTokenLimit || '1000000',
    costAmount: initialData.geminiCostAmount || '0.35',
    tokenUnit: initialData.geminiTokenUnit || '1000000',
    tested: false,
  });
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [isSavingGemini, setIsSavingGemini] = useState(false);

  // Store initial values for comparison
  const [initialDocumentAIData, setInitialDocumentAIData] = useState({
    projectId: initialData.projectId || '',
    credentials: initialData.credentials || '',
    processorId: initialData.processorId || '',
    location: initialData.location || 'us',
    maxPages: initialData.maxPages || '15',
    maxSizeMB: initialData.maxSizeMB || '20',
    monthlyPageLimit: initialData.documentAIMonthlyPageLimit || '5000',
    costAmount: initialData.documentAICostAmount || '1.50',
    pageUnit: initialData.documentAIPageUnit || '1000',
    enabled: initialData.enabled || 'false',
  });

  // Document AI State
  const [documentAIData, setDocumentAIData] = useState({
    projectId: initialData.projectId || '',
    credentials: initialData.credentials || '',
    processorId: initialData.processorId || '',
    location: initialData.location || 'us',
    maxPages: initialData.maxPages || '15',
    maxSizeMB: initialData.maxSizeMB || '20',
    monthlyPageLimit: initialData.documentAIMonthlyPageLimit || '5000',
    costAmount: initialData.documentAICostAmount || '1.50',
    pageUnit: initialData.documentAIPageUnit || '1000',
    enabled: initialData.enabled || 'false',
    skipSearchable: initialData.skipSearchable || 'true', // Default: ON (skip searchable PDFs to save costs!)
    tested: false,
  });
  const [showDocAICreds, setShowDocAICreds] = useState(false);
  const [isTestingDocAI, setIsTestingDocAI] = useState(false);
  const [isSavingDocAI, setIsSavingDocAI] = useState(false);

  // Check if data has changed
  const hasGeminiChanged = () => {
    return (
      geminiData.apiKey !== initialGeminiData.apiKey ||
      geminiData.model !== initialGeminiData.model ||
      geminiData.monthlyTokenLimit !== initialGeminiData.monthlyTokenLimit ||
      geminiData.costAmount !== initialGeminiData.costAmount ||
      geminiData.tokenUnit !== initialGeminiData.tokenUnit
    );
  };

  const hasDocumentAIChanged = () => {
    return (
      documentAIData.projectId !== initialDocumentAIData.projectId ||
      documentAIData.credentials !== initialDocumentAIData.credentials ||
      documentAIData.processorId !== initialDocumentAIData.processorId ||
      documentAIData.location !== initialDocumentAIData.location ||
      documentAIData.maxPages !== initialDocumentAIData.maxPages ||
      documentAIData.maxSizeMB !== initialDocumentAIData.maxSizeMB ||
      documentAIData.monthlyPageLimit !== initialDocumentAIData.monthlyPageLimit ||
      documentAIData.costAmount !== initialDocumentAIData.costAmount ||
      documentAIData.pageUnit !== initialDocumentAIData.pageUnit ||
      documentAIData.enabled !== initialDocumentAIData.enabled ||
      documentAIData.skipSearchable !== initialDocumentAIData.skipSearchable
    );
  };

  // Gemini Test & Save
  const testGemini = async () => {
    if (!geminiData.apiKey) {
      toast({
        title: 'Fehler',
        description: 'Bitte API Key angeben',
        variant: 'destructive',
      });
      return;
    }

    setIsTestingGemini(true);
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
    } finally {
      setIsTestingGemini(false);
    }
  };

  const saveGemini = async () => {
    setIsSavingGemini(true);
    try {
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 2,
          data: {
            geminiApiKey: geminiData.apiKey,
            geminiModel: geminiData.model,
            geminiMonthlyTokenLimit: geminiData.monthlyTokenLimit,
            geminiCostAmount: geminiData.costAmount,
            geminiTokenUnit: geminiData.tokenUnit,
          },
        }),
      });

      toast({
        title: 'Gespeichert',
        description: 'Gemini AI Einstellungen gespeichert',
        variant: 'success',
      });

      // Reset initial data to current values after save
      setInitialGeminiData({
        apiKey: geminiData.apiKey,
        model: geminiData.model,
        monthlyTokenLimit: geminiData.monthlyTokenLimit,
        costAmount: geminiData.costAmount,
        tokenUnit: geminiData.tokenUnit,
      });
      setGeminiData({ ...geminiData, tested: false });
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Konnte nicht speichern',
        variant: 'destructive',
      });
    } finally {
      setIsSavingGemini(false);
    }
  };

  // Document AI Test & Save
  const testDocumentAI = async () => {
    if (!documentAIData.projectId || !documentAIData.processorId || !documentAIData.credentials) {
      toast({
        title: 'Fehler',
        description: 'Bitte alle Felder ausfüllen',
        variant: 'destructive',
      });
      return;
    }

    setIsTestingDocAI(true);
    try {
      const response = await fetch('/api/setup/test-document-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...documentAIData,
          testType: 'connection',
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
    } finally {
      setIsTestingDocAI(false);
    }
  };

  const saveDocumentAI = async () => {
    setIsSavingDocAI(true);
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

      // Reset initial data to current values after save
      setInitialDocumentAIData({
        projectId: documentAIData.projectId,
        credentials: documentAIData.credentials,
        processorId: documentAIData.processorId,
        location: documentAIData.location,
        maxPages: documentAIData.maxPages,
        maxSizeMB: documentAIData.maxSizeMB,
        monthlyPageLimit: documentAIData.monthlyPageLimit,
        costAmount: documentAIData.costAmount,
        pageUnit: documentAIData.pageUnit,
        enabled: documentAIData.enabled,
        skipSearchable: documentAIData.skipSearchable,
      });
      setDocumentAIData({ ...documentAIData, tested: false });
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Konnte nicht speichern',
        variant: 'destructive',
      });
    } finally {
      setIsSavingDocAI(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Google OAuth Section */}
      <GoogleOAuthSettingsCard
        initialData={{
          clientId: initialData.clientId,
          clientSecret: initialData.clientSecret,
          calendarId: initialData.calendarId,
          taskListId: initialData.taskListId,
        }}
      />

      {/* Gemini AI Section */}
      <Card>
        <CardHeader>
          <CardTitle>Gemini AI</CardTitle>
          <CardDescription>{t('google_gemini_fuer_intelligentes_tagging_und_analy')}</CardDescription>
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
            <p className="text-xs text-muted-foreground mt-1">
              Empfohlen: gemini-1.5-flash oder gemini-2.0-flash-exp
            </p>
          </div>
          <div>
            <Label htmlFor="gemini-token-limit">Monatliches Token-Limit</Label>
            <Input
              id="gemini-token-limit"
              type="number"
              value={geminiData.monthlyTokenLimit}
              onChange={(e) => {
                setGeminiData({ ...geminiData, monthlyTokenLimit: e.target.value });
              }}
              placeholder="1000000"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Maximale Anzahl Tokens pro Monat (Kostenkontrolle)
            </p>
          </div>

          {/* Pricing Section */}
          <div className="pt-4 border-t">
            <h4 className="text-sm font-semibold mb-3">Preisberechnung</h4>
            <p className="text-xs text-muted-foreground mb-4">
              Geben Sie die Kosten pro Token-Einheit an für die Kostenberechnung
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="gemini-cost-amount">Kosten ($)</Label>
                <Input
                  id="gemini-cost-amount"
                  type="number"
                  step="0.01"
                  value={geminiData.costAmount}
                  onChange={(e) => {
                    setGeminiData({ ...geminiData, costAmount: e.target.value });
                  }}
                  placeholder="0.35"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Preis in Dollar
                </p>
              </div>
              <div>
                <Label htmlFor="gemini-token-unit">pro X Tokens</Label>
                <Input
                  id="gemini-token-unit"
                  type="number"
                  value={geminiData.tokenUnit}
                  onChange={(e) => {
                    setGeminiData({ ...geminiData, tokenUnit: e.target.value });
                  }}
                  placeholder="1000000"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Token-Einheit (z.B. 1000000 für 1M)
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={testGemini} variant="outline" disabled={isTestingGemini || isSavingGemini}>
              <FontAwesomeIcon icon={isTestingGemini ? faSpinner : faCheckCircle} className={`mr-2 ${isTestingGemini ? 'animate-spin' : ''}`} />
              {isTestingGemini ? 'Teste...' : 'API testen'}
            </Button>
            <Button
              onClick={saveGemini}
              disabled={isSavingGemini || isTestingGemini || !hasGeminiChanged()}
            >
              <FontAwesomeIcon icon={isSavingGemini ? faSpinner : faSave} className={`mr-2 ${isSavingGemini ? 'animate-spin' : ''}`} />
              {isSavingGemini ? 'Speichert...' : 'Speichern'}
            </Button>
            {geminiData.tested && (
              <span className="flex items-center text-sm text-green-600">
                <FontAwesomeIcon icon={faCheckCircle} className="mr-2" />
                API getestet
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Document AI Section */}
      <Card>
        <CardHeader>
          <CardTitle>Google Cloud Document AI</CardTitle>
          <CardDescription>{t('ocr_fuer_dokumentenverarbeitung')}</CardDescription>
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

          {/* Processing Limits */}
          <div className="pt-4 border-t">
            <h4 className="text-sm font-semibold mb-3">Verarbeitungslimits</h4>
            <p className="text-xs text-muted-foreground mb-4">
              PDFs die diese Limits überschreiten werden direkt an Paperless weitergeleitet (nutzt Tesseract OCR)
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="doc-ai-max-pages">Max. Seiten</Label>
                <Input
                  id="doc-ai-max-pages"
                  type="number"
                  value={documentAIData.maxPages}
                  onChange={(e) => {
                    setDocumentAIData({ ...documentAIData, maxPages: e.target.value });
                  }}
                  placeholder="15"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Standard: 15 Seiten
                </p>
              </div>

              <div>
                <Label htmlFor="doc-ai-max-size">{t('max_dateigroesse_mb')}</Label>
                <Input
                  id="doc-ai-max-size"
                  type="number"
                  value={documentAIData.maxSizeMB}
                  onChange={(e) => {
                    setDocumentAIData({ ...documentAIData, maxSizeMB: e.target.value });
                  }}
                  placeholder="20"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Standard: 20 MB
                </p>
              </div>
            </div>

            <div className="mt-4">
              <Label htmlFor="doc-ai-monthly-limit">Monatliches Seiten-Limit</Label>
              <Input
                id="doc-ai-monthly-limit"
                type="number"
                value={documentAIData.monthlyPageLimit}
                onChange={(e) => {
                  setDocumentAIData({ ...documentAIData, monthlyPageLimit: e.target.value });
                }}
                placeholder="5000"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximale Anzahl Seiten pro Monat (Kostenkontrolle). Standard: 5000 Seiten
              </p>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="pt-4 border-t">
            <h4 className="text-sm font-semibold mb-3">Preisberechnung</h4>
            <p className="text-xs text-muted-foreground mb-4">
              Geben Sie die Kosten pro Seiten-Einheit an für die Kostenberechnung
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="doc-ai-cost-amount">Kosten ($)</Label>
                <Input
                  id="doc-ai-cost-amount"
                  type="number"
                  step="0.01"
                  value={documentAIData.costAmount}
                  onChange={(e) => {
                    setDocumentAIData({ ...documentAIData, costAmount: e.target.value });
                  }}
                  placeholder="1.50"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Preis in Dollar
                </p>
              </div>
              <div>
                <Label htmlFor="doc-ai-page-unit">pro X Seiten</Label>
                <Input
                  id="doc-ai-page-unit"
                  type="number"
                  value={documentAIData.pageUnit}
                  onChange={(e) => {
                    setDocumentAIData({ ...documentAIData, pageUnit: e.target.value });
                  }}
                  placeholder="1000"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Seiten-Einheit (z.B. 1000 für pro 1000 Seiten)
                </p>
              </div>
            </div>
          </div>

          {/* Enable/Disable */}
          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="doc-ai-enabled"
              checked={documentAIData.enabled === 'true'}
              onChange={(e) => {
                setDocumentAIData({ ...documentAIData, enabled: e.target.checked ? 'true' : 'false' });
              }}
              className="w-4 h-4 rounded border-gray-300"
            />
            <Label htmlFor="doc-ai-enabled" className="cursor-pointer">
              Document AI Verarbeitung aktivieren
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Wenn deaktiviert, werden alle Dokumente direkt an Paperless weitergeleitet
          </p>

          {/* Skip searchable PDFs option */}
          <div className="flex items-center space-x-2 pt-2 pl-6 border-l-2 border-blue-200 ml-2">
            <input
              type="checkbox"
              id="doc-ai-skip-searchable"
              checked={documentAIData.skipSearchable === 'true'}
              onChange={(e) => {
                setDocumentAIData({ ...documentAIData, skipSearchable: e.target.checked ? 'true' : 'false' });
              }}
              className="w-4 h-4 rounded border-gray-300"
              disabled={documentAIData.enabled !== 'true'}
            />
            <Label htmlFor="doc-ai-skip-searchable" className={`cursor-pointer ${documentAIData.enabled !== 'true' ? 'text-muted-foreground' : ''}`}>
              PDFs mit Text-Layer überspringen (💰 Kosten sparen!)
            </Label>
          </div>
          <p className="text-xs text-muted-foreground pl-6">
            <strong>WICHTIG:</strong> Wenn aktiviert, werden PDFs die bereits durchsuchbar sind (Text-Layer vorhanden) NICHT an Document AI geschickt. Dies spart erhebliche API-Kosten! Paperless verwendet dann Tesseract OCR als Fallback.
          </p>

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
            <Button onClick={testDocumentAI} variant="outline" disabled={isTestingDocAI || isSavingDocAI}>
              <FontAwesomeIcon icon={isTestingDocAI ? faSpinner : faCheckCircle} className={`mr-2 ${isTestingDocAI ? 'animate-spin' : ''}`} />
              {isTestingDocAI ? 'Teste...' : 'Verbindung testen'}
            </Button>
            <Button
              onClick={saveDocumentAI}
              disabled={isSavingDocAI || isTestingDocAI || !hasDocumentAIChanged()}
            >
              <FontAwesomeIcon icon={isSavingDocAI ? faSpinner : faSave} className={`mr-2 ${isSavingDocAI ? 'animate-spin' : ''}`} />
              {isSavingDocAI ? 'Speichert...' : 'Speichern'}
            </Button>
            {documentAIData.tested && (
              <span className="flex items-center text-sm text-green-600">
                <FontAwesomeIcon icon={faCheckCircle} className="mr-2" />
                Verbindung getestet
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
