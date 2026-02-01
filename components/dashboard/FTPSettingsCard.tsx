"use client"

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faEye, faEyeSlash, faSpinner, faSave } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';


interface FTPSettingsCardProps {
  initialData?: {
    enabled?: boolean;
    username?: string;
    password?: string;
    port?: string;
    enableTls?: boolean;
    pasvUrl?: string;
  };
  onServiceRestart?: (service: 'ftp') => Promise<void>;
}

export default function FTPSettingsCard({ initialData = {}, onServiceRestart }: FTPSettingsCardProps) {
  const t = useTranslations('settings');

  const { toast } = useToast();

  const [ftpData, setFtpData] = useState({
    enabled: initialData.enabled || false,
    username: initialData.username || 'paiperless',
    password: initialData.password || '',
    port: initialData.port || '21',
    enableTls: initialData.enableTls || false,
    pasvUrl: initialData.pasvUrl || '',
    tested: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [serverStatus, setServerStatus] = useState<{
    running: boolean;
    message: string;
  } | null>(null);

  const loadPaperlessUrl = useCallback(async () => {
    // Load paperless URL as default for PASV URL if not set
    if (!ftpData.pasvUrl || ftpData.pasvUrl === '') {
      try {
        const response = await fetch('/api/setup/load-config?step=1');
        const config = await response.json();

        if (config.paperlessUrl) {
          // Extract hostname from Paperless URL
          const url = new URL(config.paperlessUrl);
          const hostname = url.hostname;

          // Don't use localhost
          if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '0.0.0.0') {
            setFtpData(prev => ({ ...prev, pasvUrl: hostname }));
          }
        }
      } catch (error) {
        console.error('Failed to load paperless URL:', error);
      }
    }
  }, [ftpData.pasvUrl]);

  // Load FTP server status and paperless URL on mount
  useEffect(() => {
    loadStatus();
    loadPaperlessUrl();
  }, [loadPaperlessUrl]);

  const loadStatus = async () => {
    try {
      const response = await fetch('/api/services/status');
      const data = await response.json();

      if (data.ftp) {
        setServerStatus({
          running: data.ftp.running,
          message: data.ftp.message,
        });
      }
    } catch (error) {
      console.error('Failed to load FTP status:', error);
    }
  };

  const testFtp = async () => {
    setIsTesting(true);
    toast({
      title: 'Test wird ausgeführt',
      description: 'FTP-Server Status wird geprüft...',
    });

    try {
      const response = await fetch('/api/services/status');
      const data = await response.json();

      // Update status
      await loadStatus();

      if (data.ftp?.running) {
        toast({
          title: 'FTP-Server läuft',
          description: `Port: ${ftpData.port} - ${data.ftp.message}`,
          variant: 'success',
        });
        setFtpData({ ...ftpData, tested: true });
      } else {
        toast({
          title: 'FTP-Server nicht aktiv',
          description: data.ftp?.message || 'Server ist gestoppt oder deaktiviert',
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
      setIsTesting(false);
    }
  };

  const saveFtp = async () => {
    setIsSaving(true);

    try {
      // Save configuration
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 8,
          data: {
            enabled: ftpData.enabled,
            ftpUsername: ftpData.username,
            ftpPassword: ftpData.password,
            ftpPort: parseInt(ftpData.port, 10),
            enableTls: ftpData.enableTls,
            ftpPasvUrl: ftpData.pasvUrl,
          }
        }),
      });

      toast({
        title: 'Gespeichert',
        description: 'FTP-Server Einstellungen werden übernommen...',
        variant: 'success',
      });

      // Restart FTP service if callback provided
      if (onServiceRestart) {
        await onServiceRestart('ftp');
      }

      // Reload status after restart
      setTimeout(() => loadStatus(), 2000);

      setFtpData({ ...ftpData, tested: false });
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Konnte nicht speichern',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>FTP Server</CardTitle>
        <CardDescription>Dokumente via FTP hochladen (optional)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Display */}
        {serverStatus && (
          <div className={cn(
            "flex items-center justify-between p-3 rounded-lg border",
            serverStatus.running
              ? "bg-green-50 dark:bg-[hsl(120,30%,15%)] border-green-200 dark:border-[hsl(120,30%,25%)]"
              : "bg-gray-50 dark:bg-[hsl(0,0%,15%)] border-gray-200 dark:border-[hsl(0,0%,25%)]"
          )}>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                serverStatus.running ? "bg-green-500 animate-pulse" : "bg-gray-400"
              )} />
              <span className="text-sm font-medium">
                {serverStatus.running ? 'Server läuft' : 'Server gestoppt'}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {serverStatus.message}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-0.5">
            <Label htmlFor="ftp-enabled" className="text-base">
              FTP Server aktivieren
            </Label>
            <p className="text-xs text-muted-foreground">
              Ermöglicht Upload von Dokumenten über FTP
            </p>
          </div>
          <Switch
            id="ftp-enabled"
            checked={ftpData.enabled}
            onCheckedChange={async (checked) => {
              setFtpData({ ...ftpData, enabled: checked });
              // Load default PASV URL when enabling FTP if not already set
              if (checked && (!ftpData.pasvUrl || ftpData.pasvUrl === '')) {
                await loadPaperlessUrl();
              }
            }}
          />
        </div>

        {ftpData.enabled && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ftp-username">Benutzername</Label>
                <Input
                  id="ftp-username"
                  value={ftpData.username}
                  onChange={(e) => {
                    setFtpData({ ...ftpData, username: e.target.value, tested: false });
                  }}
                  placeholder="paiperless"
                />
              </div>
              <div>
                <Label htmlFor="ftp-port">Port</Label>
                <Input
                  id="ftp-port"
                  type="number"
                  value={ftpData.port}
                  onChange={(e) => {
                    setFtpData({ ...ftpData, port: e.target.value, tested: false });
                  }}
                  placeholder="21"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="ftp-password">Passwort</Label>
              <div className="flex gap-2">
                <Input
                  id="ftp-password"
                  type={showPassword ? 'text' : 'password'}
                  value={ftpData.password}
                  onChange={(e) => {
                    setFtpData({ ...ftpData, password: e.target.value, tested: false });
                  }}
                  placeholder="Passwort"
                />
                <Button
                  variant="outline"
                  onClick={() => setShowPassword(!showPassword)}
                  size="icon"
                >
                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="ftp-pasv-url">PASV URL (Server IP/Hostname)</Label>
              <Input
                id="ftp-pasv-url"
                value={ftpData.pasvUrl}
                onChange={(e) => {
                  setFtpData({ ...ftpData, pasvUrl: e.target.value, tested: false });
                }}
                placeholder={t('192_168_1_100_oder_domain_com')}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Die IP-Adresse oder Domain, die Clients für Datenverbindungen verwenden.
                Standard: Hostname aus Paperless-URL
              </p>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="ftp-tls" className="text-base">
                  TLS/SSL Verschlüsselung
                </Label>
                <p className="text-xs text-muted-foreground">
                  FTPS für sichere Verbindungen (empfohlen)
                </p>
              </div>
              <Switch
                id="ftp-tls"
                checked={ftpData.enableTls}
                onCheckedChange={(checked) => {
                  setFtpData({ ...ftpData, enableTls: checked });
                }}
              />
            </div>
          </>
        )}

        <div className="flex gap-2">
          <Button onClick={testFtp} variant="outline" disabled={!ftpData.enabled || isSaving || isTesting}>
            <FontAwesomeIcon icon={isTesting ? faSpinner : faCheckCircle} className={`mr-2 ${isTesting ? 'animate-spin' : ''}`} />
            {isTesting ? 'Prüfe...' : 'Status prüfen'}
          </Button>
          <Button
            onClick={saveFtp}
            disabled={!ftpData.enabled || isSaving || isTesting}
            className={cn(!ftpData.enabled && 'opacity-50 cursor-not-allowed')}
          >
            <FontAwesomeIcon icon={isSaving ? faSpinner : faSave} className={`mr-2 ${isSaving ? 'animate-spin' : ''}`} />
            {isSaving ? 'Speichert...' : 'Speichern'}
          </Button>
          {ftpData.tested && (
            <span className="flex items-center text-sm text-green-600">
              <FontAwesomeIcon icon={faCheckCircle} className="mr-2" />
              Getestet
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
