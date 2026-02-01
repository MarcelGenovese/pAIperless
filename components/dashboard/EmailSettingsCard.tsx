"use client"

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faEye, faEyeSlash, faEnvelope, faSpinner, faSave } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';


interface EmailSettingsCardProps {
  initialData?: {
    enabled?: boolean;
    smtpServer?: string;
    smtpPort?: string;
    smtpEncryption?: string;
    smtpUser?: string;
    smtpPassword?: string;
    emailSender?: string;
    emailRecipients?: string;
    notifySuccess?: boolean;
    notifyError?: boolean;
    notifyApiLimit?: boolean;
    notifyApiWarning?: boolean;
    apiWarningThreshold?: string;
  };
}

export default function EmailSettingsCard({ initialData = {} }: EmailSettingsCardProps) {
  const t = useTranslations('settings');

  const { toast } = useToast();

  const [emailData, setEmailData] = useState({
    enabled: initialData.enabled || false,
    smtpServer: initialData.smtpServer || '',
    smtpPort: initialData.smtpPort || '587',
    smtpEncryption: initialData.smtpEncryption || 'STARTTLS',
    smtpUser: initialData.smtpUser || '',
    smtpPassword: initialData.smtpPassword || '',
    emailSender: initialData.emailSender || '',
    emailRecipients: initialData.emailRecipients || '',
    notifySuccess: initialData.notifySuccess ?? false,
    notifyError: initialData.notifyError ?? true, // Default: enabled
    notifyApiLimit: initialData.notifyApiLimit ?? true, // Default: enabled
    notifyApiWarning: initialData.notifyApiWarning ?? true, // Default: enabled
    apiWarningThreshold: initialData.apiWarningThreshold || '80',
    tested: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const testEmail = async () => {
    if (!emailData.enabled) {
      toast({
        title: t('email_deaktiviert'),
        description: 'Bitte aktivieren Sie Email-Benachrichtigungen',
        variant: 'destructive',
      });
      return;
    }

    setIsTesting(true);

    toast({
      title: t('test_email_wird_gesendet'),
      description: 'Bitte warten...',
    });

    try {
      // Save first
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 5,
          data: {
            enabled: emailData.enabled,
            smtpServer: emailData.smtpServer,
            smtpPort: parseInt(emailData.smtpPort, 10),
            smtpEncryption: emailData.smtpEncryption,
            smtpUser: emailData.smtpUser,
            smtpPassword: emailData.smtpPassword,
            emailSender: emailData.emailSender,
            emailRecipients: emailData.emailRecipients,
            notifySuccess: emailData.notifySuccess,
            notifyError: emailData.notifyError,
            notifyApiLimit: emailData.notifyApiLimit,
            notifyApiWarning: emailData.notifyApiWarning,
            apiWarningThreshold: parseInt(emailData.apiWarningThreshold, 10),
          }
        }),
      });

      // Test
      const response = await fetch('/api/email/test', { method: 'GET' });
      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: t('test_erfolgreich'),
          description: result.message,
          variant: 'success',
        });
        setEmailData({ ...emailData, tested: true });
      } else {
        toast({
          title: t('test_fehlgeschlagen'),
          description: result.message || 'Fehler beim Senden',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: t('test_fehlgeschlagen'),
        description: 'Netzwerkfehler',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const saveEmail = async () => {
    setIsSaving(true);

    try {
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 5,
          data: {
            enabled: emailData.enabled,
            smtpServer: emailData.smtpServer,
            smtpPort: parseInt(emailData.smtpPort, 10),
            smtpEncryption: emailData.smtpEncryption,
            smtpUser: emailData.smtpUser,
            smtpPassword: emailData.smtpPassword,
            emailSender: emailData.emailSender,
            emailRecipients: emailData.emailRecipients,
            notifySuccess: emailData.notifySuccess,
            notifyError: emailData.notifyError,
            notifyApiLimit: emailData.notifyApiLimit,
            notifyApiWarning: emailData.notifyApiWarning,
            apiWarningThreshold: parseInt(emailData.apiWarningThreshold, 10),
          }
        }),
      });

      toast({
        title: 'Gespeichert',
        description: t('email_einstellungen_gespeichert'),
        variant: 'success',
      });

      setEmailData({ ...emailData, tested: false });
    } catch (error) {
      toast({
        title: t('fehler'),
        description: t('konnte_nicht_speichern'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>E-Mail-Benachrichtigungen</CardTitle>
        <CardDescription>{t('smtp_konfiguration_fuer_benachrichtigungen_optiona')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-0.5">
            <Label htmlFor="email-enabled" className="text-base">
              E-Mail-Benachrichtigungen aktivieren
            </Label>
            <p className="text-xs text-muted-foreground">{t('erhalten_sie_benachrichtigungen_ueber_verarbeitete')}</p>
          </div>
          <Switch
            id="email-enabled"
            checked={emailData.enabled}
            onCheckedChange={(checked) => {
              setEmailData({ ...emailData, enabled: checked });
            }}
          />
        </div>

        {emailData.enabled && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="smtp-server">SMTP Server</Label>
                <Input
                  id="smtp-server"
                  value={emailData.smtpServer}
                  onChange={(e) => {
                    setEmailData({ ...emailData, smtpServer: e.target.value, tested: false });
                  }}
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div>
                <Label htmlFor="smtp-port">Port</Label>
                <Input
                  id="smtp-port"
                  type="number"
                  value={emailData.smtpPort}
                  onChange={(e) => {
                    setEmailData({ ...emailData, smtpPort: e.target.value, tested: false });
                  }}
                  placeholder="587"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="smtp-encryption">{t('smtpEncryption')}</Label>
              <select
                id="smtp-encryption"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={emailData.smtpEncryption}
                onChange={(e) => {
                  setEmailData({ ...emailData, smtpEncryption: e.target.value, tested: false });
                }}
              >
                <option value="NONE">Keine</option>
                <option value="STARTTLS">STARTTLS (587)</option>
                <option value="SSL">SSL/TLS (465)</option>
              </select>
            </div>

            <div>
              <Label htmlFor="smtp-user">Benutzername</Label>
              <Input
                id="smtp-user"
                value={emailData.smtpUser}
                onChange={(e) => {
                  setEmailData({ ...emailData, smtpUser: e.target.value, tested: false });
                }}
                placeholder="user@example.com"
              />
            </div>

            <div>
              <Label htmlFor="smtp-password">Passwort</Label>
              <div className="flex gap-2">
                <Input
                  id="smtp-password"
                  type={showPassword ? 'text' : 'password'}
                  value={emailData.smtpPassword}
                  onChange={(e) => {
                    setEmailData({ ...emailData, smtpPassword: e.target.value, tested: false });
                  }}
                  placeholder="••••••••"
                />
                <Button
                  variant="outline"
                  onClick={() => setShowPassword(!showPassword)}
                  size="icon"
                >
                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Gmail/Outlook: Verwenden Sie ein App-Passwort (siehe Dokumentation)
              </p>
            </div>

            <div>
              <Label htmlFor="email-sender">Absender-Adresse</Label>
              <Input
                id="email-sender"
                type="email"
                value={emailData.emailSender}
                onChange={(e) => {
                  setEmailData({ ...emailData, emailSender: e.target.value, tested: false });
                }}
                placeholder="noreply@example.com"
              />
            </div>

            <div>
              <Label htmlFor="email-recipients">{t('empfaenger')}</Label>
              <Input
                id="email-recipients"
                value={emailData.emailRecipients}
                onChange={(e) => {
                  setEmailData({ ...emailData, emailRecipients: e.target.value, tested: false });
                }}
                placeholder="admin@example.com, user@example.com"
              />
              <p className="text-xs text-muted-foreground mt-1">{t('kommagetrennte_liste_von_e_mail_adressen')}</p>
            </div>

            {/* Notification Settings */}
            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-semibold mb-3">Benachrichtigungseinstellungen</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 dark:bg-gray-900">
                  <div className="space-y-0.5">
                    <Label htmlFor="notify-success" className="text-sm font-medium">{t('erfolgreiche_verarbeitung')}</Label>
                    <p className="text-xs text-muted-foreground">{t('benachrichtigung_bei_erfolgreich_verarbeiteten_dok')}</p>
                  </div>
                  <Switch
                    id="notify-success"
                    checked={emailData.notifySuccess}
                    onCheckedChange={(checked) => {
                      setEmailData({ ...emailData, notifySuccess: checked });
                    }}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 dark:bg-gray-900">
                  <div className="space-y-0.5">
                    <Label htmlFor="notify-error" className="text-sm font-medium">{t('fehler_bei_verarbeitung')}</Label>
                    <p className="text-xs text-muted-foreground">
                      Benachrichtigung bei fehlgeschlagenen Dokumenten
                    </p>
                  </div>
                  <Switch
                    id="notify-error"
                    checked={emailData.notifyError}
                    onCheckedChange={(checked) => {
                      setEmailData({ ...emailData, notifyError: checked });
                    }}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 dark:bg-gray-900">
                  <div className="space-y-0.5">
                    <Label htmlFor="notify-api-limit" className="text-sm font-medium">
                      API-Limit erreicht
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Benachrichtigung bei Erreichen des monatlichen API-Limits
                    </p>
                  </div>
                  <Switch
                    id="notify-api-limit"
                    checked={emailData.notifyApiLimit}
                    onCheckedChange={(checked) => {
                      setEmailData({ ...emailData, notifyApiLimit: checked });
                    }}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 dark:bg-gray-900">
                  <div className="space-y-0.5">
                    <Label htmlFor="notify-api-warning" className="text-sm font-medium">{t('api_limit_warnung')}</Label>
                    <p className="text-xs text-muted-foreground">{t('warnung_vor_erreichen_des_api_limits')}</p>
                  </div>
                  <Switch
                    id="notify-api-warning"
                    checked={emailData.notifyApiWarning}
                    onCheckedChange={(checked) => {
                      setEmailData({ ...emailData, notifyApiWarning: checked });
                    }}
                  />
                </div>

                {emailData.notifyApiWarning && (
                  <div className="ml-4 p-3 border rounded-lg bg-white dark:bg-gray-950">
                    <Label htmlFor="api-warning-threshold" className="text-sm">
                      Warnschwelle (%)
                    </Label>
                    <Input
                      id="api-warning-threshold"
                      type="number"
                      min="1"
                      max="100"
                      value={emailData.apiWarningThreshold}
                      onChange={(e) => {
                        setEmailData({ ...emailData, apiWarningThreshold: e.target.value });
                      }}
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Benachrichtigung senden wenn {emailData.apiWarningThreshold}% des Limits erreicht sind
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <div className="flex gap-2">
          <Button onClick={testEmail} variant="outline" disabled={!emailData.enabled || isTesting || isSaving}>
            <FontAwesomeIcon icon={isTesting ? faSpinner : faEnvelope} className={`mr-2 ${isTesting ? 'animate-spin' : ''}`} />
            {isTesting ? 'Sendet...' : 'Test-Email senden'}
          </Button>
          <Button
            onClick={saveEmail}
            disabled={!emailData.enabled || isTesting || isSaving}
            className={cn(!emailData.enabled && 'opacity-50 cursor-not-allowed')}
          >
            <FontAwesomeIcon icon={isSaving ? faSpinner : faSave} className={`mr-2 ${isSaving ? 'animate-spin' : ''}`} />
            {isSaving ? 'Speichert...' : 'Speichern'}
          </Button>
          {emailData.tested && (
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
