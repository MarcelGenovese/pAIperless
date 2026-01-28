"use client"

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';

interface FTPSettingsCardProps {
  initialData?: {
    enabled?: boolean;
    username?: string;
    password?: string;
    port?: string;
    enableTls?: boolean;
  };
  onServiceRestart?: (service: 'ftp') => Promise<void>;
}

export default function FTPSettingsCard({ initialData = {}, onServiceRestart }: FTPSettingsCardProps) {
  const { toast } = useToast();

  const [ftpData, setFtpData] = useState({
    enabled: initialData.enabled || false,
    username: initialData.username || 'paiperless',
    password: initialData.password || '',
    port: initialData.port || '21',
    enableTls: initialData.enableTls || false,
    tested: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const testFtp = async () => {
    toast({
      title: 'Test wird ausgeführt',
      description: 'FTP-Server Status wird geprüft...',
    });

    try {
      const response = await fetch('/api/services/status');
      const data = await response.json();

      if (data.ftp?.status === 'connected') {
        toast({
          title: 'FTP-Server läuft',
          description: `Port: ${ftpData.port}`,
          variant: 'success',
        });
        setFtpData({ ...ftpData, tested: true });
      } else {
        toast({
          title: 'FTP-Server nicht erreichbar',
          description: data.ftp?.message || 'Fehler',
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

  const saveFtp = async () => {
    setIsSaving(true);

    try {
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
          }
        }),
      });

      toast({
        title: 'Gespeichert',
        description: 'FTP-Server Einstellungen gespeichert',
        variant: 'success',
      });

      // Restart FTP service if callback provided
      if (onServiceRestart) {
        await onServiceRestart('ftp');
      }

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
            onCheckedChange={(checked) => {
              setFtpData({ ...ftpData, enabled: checked });
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
          <Button onClick={testFtp} variant="outline" disabled={!ftpData.enabled || isSaving}>
            <FontAwesomeIcon icon={faCheckCircle} className="mr-2" />
            Status prüfen
          </Button>
          <Button
            onClick={saveFtp}
            disabled={!ftpData.enabled || isSaving}
            className={cn(!ftpData.enabled && 'opacity-50 cursor-not-allowed')}
          >
            {isSaving ? 'Wird gespeichert...' : 'Speichern'}
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
