"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRedo,
  faExclamationTriangle,
  faInfoCircle,
} from '@fortawesome/free-solid-svg-icons';

export default function AdvancedSettingsTab() {
  const router = useRouter();
  const { toast } = useToast();

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResettingSetup, setIsResettingSetup] = useState(false);

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
