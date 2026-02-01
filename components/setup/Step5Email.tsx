"use client"

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faArrowRight, faEye, faEyeSlash, faEnvelope, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useTranslations } from 'next-intl';


interface StepProps {
  onNext: (data: Record<string, any>) => void;
  onBack: () => void;
  data: Record<string, any>;
}

export default function Step5Email({ onNext, onBack, data }: StepProps) {
  const t = useTranslations('setup');

  const { toast } = useToast();

  const [enabled, setEnabled] = useState(false);
  const [smtpServer, setSmtpServer] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpEncryption, setSmtpEncryption] = useState('STARTTLS');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailSender, setEmailSender] = useState('');
  const [emailRecipients, setEmailRecipients] = useState('');
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load saved configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/setup/load-config?step=5');
        if (response.ok) {
          const savedData = await response.json();
          if (savedData.emailEnabled !== undefined) setEnabled(savedData.emailEnabled);
          if (savedData.smtpServer) setSmtpServer(savedData.smtpServer);
          if (savedData.smtpPort) setSmtpPort(savedData.smtpPort);
          if (savedData.smtpEncryption) setSmtpEncryption(savedData.smtpEncryption);
          if (savedData.smtpUser) setSmtpUser(savedData.smtpUser);
          if (savedData.smtpPassword) setSmtpPassword(savedData.smtpPassword);
          if (savedData.emailSender) setEmailSender(savedData.emailSender);
          if (savedData.emailRecipients) setEmailRecipients(savedData.emailRecipients);
        }
      } catch (error) {
        console.error('Failed to load email config:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const canProceed = !enabled || (
    smtpServer && smtpPort && smtpUser && smtpPassword && emailSender && emailRecipients
  );

  const handleTestEmail = async () => {
    if (!canProceed) {
      toast({
        title: t('fehler'),
        description: t('bitte_fuellen_sie_alle_erforderlichen_felder_aus'),
        variant: "destructive",
      });
      return;
    }

    setTesting(true);

    try {
      // Save configuration first
      console.log('[Step5Email] Saving configuration...');
      const saveResponse = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 5,
          data: {
            enabled: true,
            smtpServer,
            smtpPort: parseInt(smtpPort, 10),
            smtpEncryption,
            smtpUser,
            smtpPassword,
            emailSender,
            emailRecipients,
          }
        }),
      });

      if (!saveResponse.ok) {
        const saveError = await saveResponse.json();
        throw new Error(`Failed to save configuration: ${saveError.message || saveResponse.statusText}`);
      }

      console.log('[Step5Email] Configuration saved successfully');

      // Test email
      console.log('[Step5Email] Sending test email...');
      const response = await fetch('/api/email/test', {
        method: 'GET',
      });

      const result = await response.json();
      console.log('[Step5Email] Test result:', result);

      if (response.ok && result.success) {
        toast({
          title: t('test_erfolgreich'),
          description: result.message,
        });
      } else {
        // Show detailed error message
        const errorMsg = result.message || result.details || 'Fehler beim Senden der Test-Email';
        toast({
          title: t('test_fehlgeschlagen'),
          description: errorMsg,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('[Step5Email] Test error:', error);
      toast({
        title: t('test_fehlgeschlagen'),
        description: error.message || "Netzwerkfehler",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleNext = async () => {
    if (!canProceed) return;

    try {
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 5,
          data: {
            enabled,
            smtpServer,
            smtpPort: parseInt(smtpPort, 10),
            smtpEncryption,
            smtpUser,
            smtpPassword,
            emailSender,
            emailRecipients,
          }
        }),
      });

      onNext({});
    } catch (error) {
      toast({
        title: t('fehler'),
        description: t('e_mail_konfiguration_konnte_nicht_gespeichert_werd'),
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
            Step 5: E-Mail-Benachrichtigungen (Optional)
          </h2>
          <p className="text-muted-foreground">
            Konfigurieren Sie E-Mail-Benachrichtigungen für wichtige Ereignisse wie verarbeitete Dokumente oder Fehler.
          </p>
        </div>

        <div className="space-y-4">
          {/* Enable/Disable Switch */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="email-enabled" className="text-base">
                <FontAwesomeIcon icon={faEnvelope} className="mr-2" />
                E-Mail-Benachrichtigungen aktivieren
              </Label>
              <p className="text-xs text-muted-foreground">
                Dieses Feature ist optional und kann übersprungen werden.
              </p>
            </div>
            <Switch
              id="email-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {enabled && (
            <>
              {/* SMTP Server */}
              <div className="space-y-2">
                <Label htmlFor="smtpServer">SMTP Server</Label>
                <Input
                  id="smtpServer"
                  type="text"
                  placeholder="smtp.gmail.com"
                  value={smtpServer}
                  onChange={(e) => setSmtpServer(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Hostname oder IP-Adresse Ihres SMTP-Servers.
                </p>
              </div>

              {/* SMTP Port and Encryption */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtpPort">Port</Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    placeholder="587"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpEncryption">{t('smtpEncryption')}</Label>
                  <Select value={smtpEncryption} onValueChange={setSmtpEncryption}>
                    <SelectTrigger id="smtpEncryption">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Keine</SelectItem>
                      <SelectItem value="STARTTLS">STARTTLS (587)</SelectItem>
                      <SelectItem value="SSL">SSL/TLS (465)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* SMTP User */}
              <div className="space-y-2">
                <Label htmlFor="smtpUser">Benutzername</Label>
                <Input
                  id="smtpUser"
                  type="text"
                  placeholder="user@example.com"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  SMTP-Benutzername oder E-Mail-Adresse für die Authentifizierung.
                </p>
              </div>

              {/* SMTP Password */}
              <div className="space-y-2">
                <Label htmlFor="smtpPassword">Passwort</Label>
                <div className="relative">
                  <Input
                    id="smtpPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
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
                  SMTP-Passwort oder App-spezifisches Passwort.
                </p>
              </div>

              {/* Email Sender */}
              <div className="space-y-2">
                <Label htmlFor="emailSender">Absender-Adresse</Label>
                <Input
                  id="emailSender"
                  type="email"
                  placeholder="paiperless@example.com"
                  value={emailSender}
                  onChange={(e) => setEmailSender(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  E-Mail-Adresse, die als Absender angezeigt wird.
                </p>
              </div>

              {/* Email Recipients */}
              <div className="space-y-2">
                <Label htmlFor="emailRecipients">{t('empfaenger')}</Label>
                <Input
                  id="emailRecipients"
                  type="text"
                  placeholder="admin@example.com, user@example.com"
                  value={emailRecipients}
                  onChange={(e) => setEmailRecipients(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Kommagetrennte Liste von E-Mail-Adressen für Benachrichtigungen.
                </p>
              </div>

              {/* Test Email Button */}
              <div className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestEmail}
                  disabled={!canProceed || testing}
                  className="w-full"
                >
                  <FontAwesomeIcon icon={testing ? faSpinner : faEnvelope} className={`mr-2 ${testing ? 'animate-spin' : ''}`} />
                  {testing ? 'Test-Email wird gesendet...' : 'Test-Email senden'}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Speichert die Konfiguration und sendet eine Test-Email an alle Empfänger.
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
