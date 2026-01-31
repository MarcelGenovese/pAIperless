"use client"

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle,
  faTimesCircle,
  faSpinner,
  faExclamationTriangle,
  faTimes,
  faInfoCircle,
  faStethoscope
} from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/components/ui/button';

interface SystemCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'inactive';
  message?: string;
  detail?: string;
}

export default function SystemCheckModal({ isOpen, onClose }: SystemCheckModalProps) {
  const [tests, setTests] = useState<TestResult[]>([
    { name: 'Paperless-NGX Verbindung', status: 'pending' },
    { name: 'Paperless Workflows', status: 'pending' },
    { name: 'Webhook API Keys', status: 'pending' },
    { name: 'Paperless OCR-Einstellungen', status: 'pending' },
    { name: 'Google OAuth', status: 'pending' },
    { name: 'Gemini AI', status: 'pending' },
    { name: 'Google Cloud Document AI', status: 'pending' },
    { name: 'FTP-Server', status: 'pending' },
    { name: 'E-Mail-Benachrichtigungen', status: 'pending' },
  ]);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (isOpen && !isRunning) {
      runSystemCheck();
    }
  }, [isOpen]);

  const runSystemCheck = async () => {
    setIsRunning(true);

    // Test 1: Paperless-NGX
    setTests(prev => prev.map((t, i) => i === 0 ? { ...t, status: 'running' } : t));
    let paperlessData: any = null;
    try {
      const res = await fetch('/api/setup/test-paperless', { method: 'POST' });
      paperlessData = await res.json();
      setTests(prev => prev.map((t, i) =>
        i === 0 ? {
          ...t,
          status: res.ok ? 'success' : 'error',
          message: res.ok ? 'Verbindung erfolgreich' : paperlessData.error || 'Verbindung fehlgeschlagen'
        } : t
      ));
    } catch (error: any) {
      setTests(prev => prev.map((t, i) =>
        i === 0 ? { ...t, status: 'error', message: 'Netzwerkfehler' } : t
      ));
    }

    // Test 2: Paperless Workflows
    setTests(prev => prev.map((t, i) => i === 1 ? { ...t, status: 'running' } : t));
    try {
      const res = await fetch('/api/setup/test-webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Empty body - will use stored config
      });
      const data = await res.json();
      console.log('[System Check] Workflow test response:', res.status, data);

      if (res.ok && data.webhooksExist) {
        setTests(prev => prev.map((t, i) =>
          i === 1 ? {
            ...t,
            status: 'success',
            message: 'Alle erforderlichen Workflows gefunden'
          } : t
        ));
      } else {
        const missing = data.missingWebhooks || [];
        const errorMsg = data.error || `Fehlende Workflows: ${missing.join(', ') || 'unbekannt'}`;
        setTests(prev => prev.map((t, i) =>
          i === 1 ? {
            ...t,
            status: 'error',
            message: errorMsg,
            detail: data.details || 'Bitte erstellen Sie die Workflows in Paperless-NGX oder verwenden Sie "Auto-Create"'
          } : t
        ));
      }
    } catch (error: any) {
      console.error('[System Check] Workflow test error:', error);
      setTests(prev => prev.map((t, i) =>
        i === 1 ? { ...t, status: 'error', message: `Workflow-Prüfung fehlgeschlagen: ${error.message}` } : t
      ));
    }

    // Test 3: Webhook API Keys
    setTests(prev => prev.map((t, i) => i === 2 ? { ...t, status: 'running' } : t));
    try {
      const res = await fetch('/api/webhooks/validate');
      const data = await res.json();
      if (data.valid) {
        setTests(prev => prev.map((t, i) =>
          i === 2 ? {
            ...t,
            status: 'success',
            message: 'Alle Webhook API Keys sind aktuell'
          } : t
        ));
      } else {
        const invalidCount = data.workflows?.filter((w: any) => w.hasWebhook && !w.apiKeyMatch).length || 0;
        setTests(prev => prev.map((t, i) =>
          i === 2 ? {
            ...t,
            status: 'error',
            message: `${invalidCount} Workflow(s) mit veraltetem API Key`,
            detail: 'Bitte API Key in Workflows aktualisieren oder auf "Aktualisieren" klicken'
          } : t
        ));
      }
    } catch (error: any) {
      setTests(prev => prev.map((t, i) =>
        i === 2 ? { ...t, status: 'error', message: 'Prüfung fehlgeschlagen' } : t
      ));
    }

    // Test 4: Paperless OCR
    setTests(prev => prev.map((t, i) => i === 3 ? { ...t, status: 'running' } : t));
    try {
      const res = await fetch('/api/paperless/check-ocr');
      const data = await res.json();
      setTests(prev => prev.map((t, i) =>
        i === 3 ? {
          ...t,
          status: data.valid ? 'success' : 'error',
          message: data.message
        } : t
      ));
    } catch (error: any) {
      setTests(prev => prev.map((t, i) =>
        i === 3 ? { ...t, status: 'error', message: 'Prüfung fehlgeschlagen' } : t
      ));
    }

    // Test 5: Google OAuth
    setTests(prev => prev.map((t, i) => i === 4 ? { ...t, status: 'running' } : t));
    try {
      const res = await fetch('/api/auth/google/test', { method: 'POST' });
      const data = await res.json();
      if (data.inactive) {
        setTests(prev => prev.map((t, i) =>
          i === 4 ? { ...t, status: 'inactive', message: 'Nicht konfiguriert' } : t
        ));
      } else {
        setTests(prev => prev.map((t, i) =>
          i === 4 ? {
            ...t,
            status: res.ok ? 'success' : 'error',
            message: res.ok ? 'OAuth erfolgreich' : data.error || 'OAuth fehlgeschlagen'
          } : t
        ));
      }
    } catch (error: any) {
      setTests(prev => prev.map((t, i) =>
        i === 4 ? { ...t, status: 'error', message: 'Test fehlgeschlagen' } : t
      ));
    }

    // Test 6: Gemini AI
    setTests(prev => prev.map((t, i) => i === 5 ? { ...t, status: 'running' } : t));
    try {
      const res = await fetch('/api/setup/test-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Uses stored config
      });
      const data = await res.json();
      setTests(prev => prev.map((t, i) =>
        i === 5 ? {
          ...t,
          status: res.ok ? 'success' : 'error',
          message: res.ok ? 'API funktioniert' : data.error || 'API fehlgeschlagen'
        } : t
      ));
    } catch (error: any) {
      setTests(prev => prev.map((t, i) =>
        i === 5 ? { ...t, status: 'error', message: 'Test fehlgeschlagen' } : t
      ));
    }

    // Test 7: Document AI
    setTests(prev => prev.map((t, i) => i === 6 ? { ...t, status: 'running' } : t));
    try {
      const res = await fetch('/api/setup/test-document-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType: 'connection' })
      });
      const data = await res.json();
      if (data.inactive) {
        setTests(prev => prev.map((t, i) =>
          i === 6 ? { ...t, status: 'inactive', message: 'Deaktiviert' } : t
        ));
      } else {
        setTests(prev => prev.map((t, i) =>
          i === 6 ? {
            ...t,
            status: res.ok ? 'success' : 'error',
            message: res.ok ? 'Verbindung erfolgreich' : data.error || 'Verbindung fehlgeschlagen'
          } : t
        ));
      }
    } catch (error: any) {
      setTests(prev => prev.map((t, i) =>
        i === 6 ? { ...t, status: 'error', message: 'Test fehlgeschlagen' } : t
      ));
    }

    // Test 8: FTP Server
    setTests(prev => prev.map((t, i) => i === 7 ? { ...t, status: 'running' } : t));
    try {
      const res = await fetch('/api/services/status');
      const data = await res.json();
      if (!data.ftp?.enabled) {
        setTests(prev => prev.map((t, i) =>
          i === 7 ? { ...t, status: 'inactive', message: 'Deaktiviert' } : t
        ));
      } else {
        setTests(prev => prev.map((t, i) =>
          i === 7 ? {
            ...t,
            status: data.ftp?.running ? 'success' : 'error',
            message: data.ftp?.running ? `Läuft auf Port ${data.ftp.port}` : 'Server nicht aktiv'
          } : t
        ));
      }
    } catch (error: any) {
      setTests(prev => prev.map((t, i) =>
        i === 7 ? { ...t, status: 'error', message: 'Statusprüfung fehlgeschlagen' } : t
      ));
    }

    // Test 9: Email
    setTests(prev => prev.map((t, i) => i === 8 ? { ...t, status: 'running' } : t));
    try {
      const res = await fetch('/api/email/status');
      const data = await res.json();
      if (!data.enabled) {
        setTests(prev => prev.map((t, i) =>
          i === 8 ? { ...t, status: 'inactive', message: 'Deaktiviert' } : t
        ));
      } else {
        // Test SMTP connection
        const testRes = await fetch('/api/email/test', { method: 'POST' });
        const testData = await testRes.json();
        setTests(prev => prev.map((t, i) =>
          i === 8 ? {
            ...t,
            status: testRes.ok ? 'success' : 'error',
            message: testRes.ok ? 'SMTP-Verbindung erfolgreich' : testData.error || 'Verbindung fehlgeschlagen'
          } : t
        ));
      }
    } catch (error: any) {
      setTests(prev => prev.map((t, i) =>
        i === 8 ? { ...t, status: 'error', message: 'Test fehlgeschlagen' } : t
      ));
    }

    setIsRunning(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <FontAwesomeIcon icon={faCheckCircle} className="text-green-600 text-xl" />;
      case 'error':
        return <FontAwesomeIcon icon={faTimesCircle} className="text-red-600 text-xl" />;
      case 'running':
        return <FontAwesomeIcon icon={faSpinner} className="text-blue-600 text-xl animate-spin" />;
      case 'inactive':
        return <FontAwesomeIcon icon={faInfoCircle} className="text-gray-400 text-xl" />;
      default:
        return <FontAwesomeIcon icon={faExclamationTriangle} className="text-gray-300 text-xl" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <FontAwesomeIcon icon={faStethoscope} className="text-blue-600" />
            System Check
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isRunning}
          >
            <FontAwesomeIcon icon={faTimes} />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-3">
            {tests.map((test, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800"
              >
                <div className="flex-shrink-0">
                  {getStatusIcon(test.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {test.name}
                  </h3>
                  {test.message && (
                    <p className={`text-sm mt-1 ${
                      test.status === 'success' ? 'text-green-600 dark:text-green-400' :
                      test.status === 'error' ? 'text-red-600 dark:text-red-400' :
                      test.status === 'inactive' ? 'text-gray-500' :
                      'text-gray-600 dark:text-gray-400'
                    }`}>
                      {test.message}
                    </p>
                  )}
                  {test.detail && (
                    <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                      {test.detail}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          {!isRunning && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-[hsl(0,0%,15%)] border border-blue-200 dark:border-[hsl(0,0%,25%)] rounded-lg">
              <div className="flex items-start gap-3">
                <FontAwesomeIcon icon={faInfoCircle} className="text-blue-600 text-lg mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    Zusammenfassung
                  </h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    {tests.filter(t => t.status === 'success').length} erfolgreich, {' '}
                    {tests.filter(t => t.status === 'error').length} fehlgeschlagen, {' '}
                    {tests.filter(t => t.status === 'inactive').length} inaktiv
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => runSystemCheck()}
            disabled={isRunning}
          >
            {isRunning ? (
              <>
                <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                Läuft...
              </>
            ) : (
              'Erneut prüfen'
            )}
          </Button>
          <Button onClick={onClose} disabled={isRunning}>
            Schließen
          </Button>
        </div>
      </div>
    </div>
  );
}
