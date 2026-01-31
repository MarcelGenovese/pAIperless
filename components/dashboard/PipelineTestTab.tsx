"use client"

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUpload,
  faCheckCircle,
  faExclamationCircle,
  faSpinner,
  faClock,
  faFileAlt,
  faCog,
  faRobot,
  faCalendar,
  faListCheck,
} from '@fortawesome/free-solid-svg-icons';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PipelineStep {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  icon: any;
  details: string[];
  timestamp?: string;
}

interface ConfigInfo {
  [key: string]: string | boolean | number;
}

export default function PipelineTestTab() {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);
  const [testId, setTestId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [configInfo, setConfigInfo] = useState<ConfigInfo | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  // Load config info on mount
  useEffect(() => {
    loadConfigInfo();
  }, []);

  const loadConfigInfo = async () => {
    try {
      const response = await fetch('/api/pipeline-test/config');
      const data = await response.json();
      setConfigInfo(data);
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const initialSteps: PipelineStep[] = [
    {
      id: 'upload',
      title: '1. Upload & Duplikatsprüfung',
      status: 'pending',
      icon: faUpload,
      details: []
    },
    {
      id: 'preprocessing',
      title: '2. Vorverarbeitung',
      status: 'pending',
      icon: faCog,
      details: []
    },
    {
      id: 'ocr',
      title: '3. Document AI OCR',
      status: 'pending',
      icon: faFileAlt,
      details: []
    },
    {
      id: 'paperless_upload',
      title: '4. Paperless Upload',
      status: 'pending',
      icon: faCheckCircle,
      details: []
    },
    {
      id: 'ai_tagging',
      title: '5. AI-Tagging',
      status: 'pending',
      icon: faRobot,
      details: []
    },
    {
      id: 'action_detection',
      title: '6. Action Required Erkennung',
      status: 'pending',
      icon: faExclamationCircle,
      details: []
    },
    {
      id: 'calendar_tasks',
      title: '7. Calendar & Tasks',
      status: 'pending',
      icon: faCalendar,
      details: []
    },
    {
      id: 'task_completion',
      title: '8. Task-Abhaken (Simulation)',
      status: 'pending',
      icon: faListCheck,
      details: []
    },
  ];

  useEffect(() => {
    if (testId) {
      // Start polling for status updates
      pollInterval.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/pipeline-test/${testId}/status`);
          const data = await response.json();

          if (data.steps) {
            setSteps(data.steps);
          }

          // Check if test is complete
          const lastStep = data.steps[data.steps.length - 1];
          if (lastStep.status === 'success' || lastStep.status === 'error') {
            setTesting(false);
            if (pollInterval.current) {
              clearInterval(pollInterval.current);
            }
          }
        } catch (error) {
          console.error('Failed to poll test status:', error);
        }
      }, 2000);
    }

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [testId]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({
          title: 'Ungültiger Dateityp',
          description: 'Bitte wählen Sie eine PDF-Datei',
          variant: 'destructive',
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const startTest = async () => {
    if (!selectedFile) {
      toast({
        title: 'Keine Datei ausgewählt',
        description: 'Bitte wählen Sie eine PDF-Datei',
        variant: 'destructive',
      });
      return;
    }

    setTesting(true);
    setSteps(initialSteps);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/pipeline-test/start', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.testId) {
        setTestId(data.testId);
        toast({
          title: 'Pipeline-Test gestartet',
          description: 'Die Verarbeitung läuft...',
        });
      } else {
        throw new Error(data.error || 'Test konnte nicht gestartet werden');
      }
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
      setTesting(false);
    }
  };

  const getStepIcon = (step: PipelineStep) => {
    if (step.status === 'running') {
      return <FontAwesomeIcon icon={faSpinner} className="animate-spin text-blue-600" />;
    } else if (step.status === 'success') {
      return <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />;
    } else if (step.status === 'error') {
      return <FontAwesomeIcon icon={faExclamationCircle} className="text-red-600" />;
    } else if (step.status === 'skipped') {
      return <FontAwesomeIcon icon={faClock} className="text-gray-400" />;
    } else {
      return <FontAwesomeIcon icon={step.icon} className="text-gray-400" />;
    }
  };

  const getStepBackgroundColor = (step: PipelineStep) => {
    if (step.status === 'running') {
      return 'bg-blue-50 dark:bg-[hsl(210,40%,15%)] border-blue-200 dark:border-[hsl(210,40%,25%)]';
    } else if (step.status === 'success') {
      return 'bg-green-50 dark:bg-[hsl(120,30%,15%)] border-green-200 dark:border-[hsl(120,30%,25%)]';
    } else if (step.status === 'error') {
      return 'bg-red-50 dark:bg-[hsl(0,40%,15%)] border-red-200 dark:border-[hsl(0,40%,25%)]';
    } else if (step.status === 'skipped') {
      return 'bg-gray-50 dark:bg-[hsl(0,0%,15%)] border-gray-200 dark:border-[hsl(0,0%,25%)]';
    } else {
      return 'border-gray-200 dark:border-[hsl(0,0%,25%)]';
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline End-to-End Test</CardTitle>
          <CardDescription>
            Testen Sie die komplette Verarbeitungspipeline: Upload → OCR → Paperless → AI-Tagging → Calendar/Tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              disabled={testing}
              className="block w-full text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 focus:outline-none"
            />
            <Button
              onClick={startTest}
              disabled={!selectedFile || testing}
              className="whitespace-nowrap"
            >
              <FontAwesomeIcon icon={testing ? faSpinner : faUpload} className={cn("mr-2", testing && "animate-spin")} />
              {testing ? 'Test läuft...' : 'Test starten'}
            </Button>
          </div>

          {selectedFile && (
            <div className="text-sm text-muted-foreground">
              Ausgewählte Datei: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pipeline Steps */}
      {steps.length > 0 && (
        <div className="space-y-3">
          {steps.map((step, index) => (
            <Card
              key={step.id}
              className={cn(
                'transition-all',
                getStepBackgroundColor(step)
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                    {getStepIcon(step)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold mb-1">{step.title}</h4>
                    {step.timestamp && (
                      <p className="text-xs text-muted-foreground mb-2">
                        {new Date(step.timestamp).toLocaleTimeString('de-DE')}
                      </p>
                    )}
                    {step.details.length > 0 && (
                      <ul className="space-y-1">
                        {step.details.map((detail, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                            <span className="text-blue-600 dark:text-blue-400">→</span>
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Box */}
      {!testing && steps.length === 0 && (
        <Card className="bg-blue-50 dark:bg-[hsl(210,40%,15%)] border-blue-200 dark:border-[hsl(210,40%,25%)]">
          <CardContent className="p-6">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <FontAwesomeIcon icon={faFileAlt} className="text-blue-600" />
              So funktioniert der Test
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Laden Sie eine PDF-Datei hoch um die komplette Pipeline zu testen</li>
              <li>• Der Test zeigt jeden Schritt der Verarbeitung in Echtzeit</li>
              <li>• Alle Fehler, Entscheidungen und Ergebnisse werden angezeigt</li>
              <li>• Die Seite kann während des Tests gewechselt werden - der Status bleibt erhalten</li>
              <li>• Der Test endet erfolgreich wenn keine Action Required erkannt wird</li>
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Configuration Parameters */}
      {configInfo && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Aktuelle Konfiguration</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfig(!showConfig)}
              >
                {showConfig ? 'Verbergen' : 'Anzeigen'}
              </Button>
            </div>
            <CardDescription>
              Parameter die den Verarbeitungsprozess beeinflussen
            </CardDescription>
          </CardHeader>
          {showConfig && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {/* Paperless */}
                <div className="space-y-2">
                  <h5 className="font-semibold text-blue-600 dark:text-blue-400">Paperless Integration</h5>
                  <div className="space-y-1 text-xs">
                    <div><span className="font-medium">AI Todo Tag:</span> {configInfo.tagAiTodo || 'N/A'}</div>
                    <div><span className="font-medium">Action Required Tag:</span> {configInfo.tagActionRequired || 'N/A'}</div>
                    <div><span className="font-medium">Action Description Field:</span> {configInfo.fieldActionDescription || 'N/A'}</div>
                    <div><span className="font-medium">Due Date Field:</span> {configInfo.fieldDueDate || 'N/A'}</div>
                  </div>
                </div>

                {/* Document AI */}
                <div className="space-y-2">
                  <h5 className="font-semibold text-blue-600 dark:text-blue-400">Document AI</h5>
                  <div className="space-y-1 text-xs">
                    <div><span className="font-medium">Enabled:</span> {configInfo.documentAIEnabled ? 'Ja' : 'Nein'}</div>
                    <div><span className="font-medium">Max Pages:</span> {configInfo.documentAIMaxPages || 'N/A'}</div>
                    <div><span className="font-medium">Max Size (MB):</span> {configInfo.documentAIMaxSizeMB || 'N/A'}</div>
                    <div><span className="font-medium">Location:</span> {configInfo.documentAILocation || 'N/A'}</div>
                  </div>
                </div>

                {/* Gemini */}
                <div className="space-y-2">
                  <h5 className="font-semibold text-blue-600 dark:text-blue-400">Gemini AI</h5>
                  <div className="space-y-1 text-xs">
                    <div><span className="font-medium">Model:</span> {configInfo.geminiModel || 'N/A'}</div>
                    <div><span className="font-medium">Tag Mode:</span> {configInfo.geminiTagMode || 'N/A'}</div>
                    <div><span className="font-medium">Max Tags:</span> {configInfo.geminiMaxTags || 'N/A'}</div>
                    <div><span className="font-medium">Custom Fields:</span> {configInfo.geminiFillCustomFields ? 'Ja' : 'Nein'}</div>
                    <div><span className="font-medium">Strict Correspondents:</span> {configInfo.geminiStrictCorrespondents ? 'Ja' : 'Nein'}</div>
                    <div><span className="font-medium">Strict Document Types:</span> {configInfo.geminiStrictDocumentTypes ? 'Ja' : 'Nein'}</div>
                  </div>
                </div>

                {/* Polling */}
                <div className="space-y-2">
                  <h5 className="font-semibold text-blue-600 dark:text-blue-400">Verarbeitung</h5>
                  <div className="space-y-1 text-xs">
                    <div><span className="font-medium">AI Todo Polling:</span> {configInfo.pollAiTodoEnabled ? 'Aktiviert' : 'Deaktiviert'}</div>
                    {configInfo.pollAiTodoEnabled && (
                      <div><span className="font-medium">Polling Interval:</span> {configInfo.pollAiTodoInterval} min</div>
                    )}
                    <div><span className="font-medium">Action Polling:</span> {configInfo.pollActionEnabled ? 'Aktiviert' : 'Deaktiviert'}</div>
                    {configInfo.pollActionEnabled && (
                      <div><span className="font-medium">Action Interval:</span> {configInfo.pollActionInterval} min</div>
                    )}
                  </div>
                </div>

                {/* Custom Prompt */}
                {configInfo.geminiPromptTemplate && (
                  <div className="col-span-full space-y-2">
                    <h5 className="font-semibold text-blue-600 dark:text-blue-400">Custom Prompt Template</h5>
                    <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-x-auto max-h-40 overflow-y-auto">
                      {configInfo.geminiPromptTemplate}
                    </pre>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
