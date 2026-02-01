"use client"

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faArrowRight, faEye, faEyeSlash, faServer, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useTranslations } from 'next-intl';


interface StepProps {
  onNext: (data: Record<string, any>) => void;
  onBack: () => void;
  data: Record<string, any>;
}

export default function Step8FTP({ onNext, onBack, data }: StepProps) {
  const t = useTranslations('setup');

  const { toast } = useToast();

  const [enabled, setEnabled] = useState(false);
  const [ftpUsername, setFtpUsername] = useState('paiperless');
  const [ftpPassword, setFtpPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [ftpPort, setFtpPort] = useState('21');
  const [enableTls, setEnableTls] = useState(true);
  const [loading, setLoading] = useState(true);

  // Load saved configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/setup/load-config?step=8');
        if (response.ok) {
          const savedData = await response.json();
          if (savedData.ftpEnabled !== undefined) setEnabled(savedData.ftpEnabled);
          if (savedData.ftpUsername) setFtpUsername(savedData.ftpUsername);
          if (savedData.ftpPassword) setFtpPassword(savedData.ftpPassword);
          if (savedData.ftpPort) setFtpPort(savedData.ftpPort);
          if (savedData.ftpEnableTls !== undefined) setEnableTls(savedData.ftpEnableTls);
        }
      } catch (error) {
        console.error('Failed to load FTP config:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const canProceed = !enabled || (ftpUsername && ftpPassword);

  const handleNext = async () => {
    if (!canProceed) return;

    try {
      console.log('[Step8FTP] Saving FTP configuration...');
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 8,
          data: {
            enabled,
            ftpUsername,
            ftpPassword,
            ftpPort: parseInt(ftpPort, 10),
            enableTls,
          }
        }),
      });

      const result = await response.json();
      console.log('[Step8FTP] Save result:', result);

      if (response.ok) {
        // Show FTP server status if enabled
        if (enabled && result.ftpStarted !== undefined) {
          if (result.ftpStarted) {
            toast({
              title: "FTP Server gestartet",
              description: result.ftpMessage || `FTP Server läuft auf Port ${ftpPort}`,
            });
          } else {
            toast({
              title: "Warnung",
              description: result.ftpMessage || "FTP-Konfiguration gespeichert, aber Server konnte nicht gestartet werden",
              variant: "destructive",
            });
          }
        }
        onNext({});
      } else {
        throw new Error(result.error || 'Fehler beim Speichern');
      }
    } catch (error: any) {
      console.error('[Step8FTP] Save error:', error);
      toast({
        title: "Fehler",
        description: error.message || "FTP-Konfiguration konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex justify-center items-center py-12">
        <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-accent mb-2">
            Step 8: FTP Server (Optional)
          </h2>
          <p className="text-muted-foreground">
            Aktivieren Sie einen FTP-Server, um Dokumente direkt vom Scanner oder anderen Geräten hochzuladen.
          </p>
        </div>

        <div className="space-y-4">
          {/* Enable/Disable Switch */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="ftp-enabled" className="text-base">
                <FontAwesomeIcon icon={faServer} className="mr-2" />
                FTP Server aktivieren
              </Label>
              <p className="text-xs text-muted-foreground">
                Dieses Feature ist optional. Sie können auch das /consume Verzeichnis direkt verwenden.
              </p>
            </div>
            <Switch
              id="ftp-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {enabled && (
            <>
              {/* Info Box */}
              <div className="p-4 border rounded-lg bg-blue-50 dark:bg-[hsl(0,0%,15%)]">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>Hinweis:</strong> Der FTP-Server wird auf Port {ftpPort} gebunden und erlaubt Uploads direkt in den /consume Ordner.
                  Stellen Sie sicher, dass dieser Port in Ihrer Firewall freigegeben ist.
                </p>
              </div>

              {/* FTP Username */}
              <div className="space-y-2">
                <Label htmlFor="ftpUsername">FTP Benutzername</Label>
                <Input
                  id="ftpUsername"
                  type="text"
                  placeholder="paiperless"
                  value={ftpUsername}
                  onChange={(e) => setFtpUsername(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Benutzername für FTP-Zugriff. Standard: paiperless
                </p>
              </div>

              {/* FTP Password */}
              <div className="space-y-2">
                <Label htmlFor="ftpPassword">FTP Passwort</Label>
                <div className="relative">
                  <Input
                    id="ftpPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Sicheres Passwort eingeben"
                    value={ftpPassword}
                    onChange={(e) => setFtpPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Wählen Sie ein sicheres Passwort. Empfohlen: mindestens 12 Zeichen.
                </p>
              </div>

              {/* FTP Port */}
              <div className="space-y-2">
                <Label htmlFor="ftpPort">FTP Port</Label>
                <Input
                  id="ftpPort"
                  type="number"
                  min="1"
                  max="65535"
                  placeholder="21"
                  value={ftpPort}
                  onChange={(e) => setFtpPort(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Port für FTP-Server. Standard: 21 (erfordert Root-Rechte) oder z.B. 2121.
                </p>
              </div>

              {/* Enable TLS */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="enableTls" className="text-base">
                    TLS/SSL Verschlüsselung aktivieren (FTPS)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Verschlüsselt die FTP-Verbindung für erhöhte Sicherheit. Empfohlen.
                  </p>
                </div>
                <Switch
                  id="enableTls"
                  checked={enableTls}
                  onCheckedChange={setEnableTls}
                />
              </div>

              {/* Connection Details Box */}
              <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
                <h4 className="font-semibold mb-2 text-sm">FTP Verbindungsdaten:</h4>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Host:</span>
                    <span>{typeof window !== 'undefined' ? window.location.hostname : '[server-ip]'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Port:</span>
                    <span>{ftpPort}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Benutzername:</span>
                    <span>{ftpUsername}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('verschluesselung')}</span>
                    <span>{enableTls ? 'FTPS (TLS/SSL)' : 'Keine (unsicher)'}</span>
                  </div>
                </div>
              </div>

              {/* Warning Box */}
              {!enableTls && (
                <div className="p-4 border rounded-lg bg-red-50 dark:bg-[hsl(0,40%,15%)]">
                  <p className="text-sm text-red-900 dark:text-red-100">
                    <strong>⚠️ Sicherheitswarnung:</strong> FTP ohne TLS überträgt Benutzername und Passwort im Klartext.
                    Dies sollte nur in vertrauenswürdigen Netzwerken verwendet werden. TLS wird dringend empfohlen.
                  </p>
                </div>
              )}

              {/* Implementation Note */}
              <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-[hsl(45,40%,15%)]">
                <p className="text-sm text-yellow-900 dark:text-yellow-100">
                  <strong>📝 Hinweis zur Implementierung:</strong> Der FTP-Server wird beim ersten Start automatisch konfiguriert.
                  Es kann einige Sekunden dauern, bis der Server verfügbar ist. Ein Neustart des Containers ist erforderlich,
                  um Änderungen an der FTP-Konfiguration zu übernehmen.
                </p>
              </div>
            </>
          )}
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
