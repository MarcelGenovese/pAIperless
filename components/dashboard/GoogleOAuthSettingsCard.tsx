"use client"

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExternalLinkAlt, faCalendar, faListUl, faEye, faEyeSlash, faSpinner, faSave, faRotate } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';

interface GoogleOAuthSettingsCardProps {
  initialData?: {
    clientId?: string;
    clientSecret?: string;
    calendarId?: string;
    taskListId?: string;
  };
}

export default function GoogleOAuthSettingsCard({ initialData = {} }: GoogleOAuthSettingsCardProps) {
  const { toast } = useToast();

  const [oauthData, setOAuthData] = useState({
    clientId: initialData.clientId || '',
    clientSecret: initialData.clientSecret || '',
    calendarId: initialData.calendarId || '',
    taskListId: initialData.taskListId || '',
    tested: false,
  });
  const [showSecret, setShowSecret] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [calendars, setCalendars] = useState<Array<{ id: string; name: string }>>([]);
  const [taskLists, setTaskLists] = useState<Array<{ id: string; name: string }>>([]);

  // Check authorization status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    if (!oauthData.clientId || !oauthData.clientSecret) return;

    try {
      const response = await fetch('/api/auth/google/resources');
      if (response.ok) {
        setIsAuthorized(true);
        const resources = await response.json();
        if (resources.calendars) setCalendars(resources.calendars);
        if (resources.taskLists) setTaskLists(resources.taskLists);
      }
    } catch (error) {
      console.error('Failed to check OAuth status:', error);
    }
  };

  const handleAuthorize = async () => {
    if (!oauthData.clientId || !oauthData.clientSecret) {
      toast({
        title: t('status.error'),
        description: 'Bitte Client ID und Secret angeben',
        variant: 'destructive',
      });
      return;
    }

    // Save credentials first
    try {
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 4,
          data: {
            clientId: oauthData.clientId,
            clientSecret: oauthData.clientSecret,
          }
        }),
      });

      // Get OAuth URL
      const response = await fetch('/api/auth/google/url');
      const data = await response.json();

      if (data.url) {
        // Redirect to OAuth consent screen
        window.location.href = data.url;
      } else {
        throw new Error('No OAuth URL returned');
      }
    } catch (error) {
      toast({
        title: t('status.error'),
        description: 'Konnte OAuth nicht starten',
        variant: 'destructive',
      });
    }
  };

  const loadResources = async () => {
    if (!isAuthorized) return;

    setIsLoadingResources(true);
    try {
      const response = await fetch('/api/auth/google/resources');
      if (response.ok) {
        const resources = await response.json();
        if (resources.calendars) setCalendars(resources.calendars);
        if (resources.taskLists) setTaskLists(resources.taskLists);
        toast({
          title: 'Erfolgreich',
          description: 'Kalender und Aufgabenlisten geladen',
          variant: 'success',
        });
      } else {
        throw new Error('Failed to load resources');
      }
    } catch (error) {
      toast({
        title: t('status.error'),
        description: 'Konnte Ressourcen nicht laden',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingResources(false);
    }
  };

  const testOAuth = async () => {
    if (!oauthData.calendarId || !oauthData.taskListId) {
      toast({
        title: t('status.error'),
        description: 'Bitte Kalender und Aufgabenliste auswählen',
        variant: 'destructive',
      });
      return;
    }

    setIsTesting(true);
    try {
      const response = await fetch('/api/auth/google/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId: oauthData.calendarId,
          taskListId: oauthData.taskListId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setOAuthData({ ...oauthData, tested: true });
        toast({
          title: 'Test erfolgreich! 🎉',
          description: 'Test-Eintrag in Kalender und Aufgaben erstellt. Diese bleiben als Erfolgserlebnis bestehen!',
          variant: 'success',
        });
      } else {
        toast({
          title: 'Test teilweise erfolgreich',
          description: result.message || 'Einige Tests sind fehlgeschlagen',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Test fehlgeschlagen',
        description: 'Netzwerkfehler beim Testen',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);

    try {
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 4,
          data: {
            clientId: oauthData.clientId,
            clientSecret: oauthData.clientSecret,
            calendarId: oauthData.calendarId,
            taskListId: oauthData.taskListId,
          }
        }),
      });

      toast({
        title: t('saved'),
        description: 'Google OAuth Einstellungen gespeichert',
        variant: 'success',
      });

      setOAuthData({ ...oauthData, tested: false });
    } catch (error) {
      toast({
        title: t('status.error'),
        description: 'Konnte nicht speichern',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Check for OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('oauth_success');
    const error = params.get('oauth_error');

    if (success === 'true') {
      setIsAuthorized(true);
      loadResources();
      toast({
        title: 'Autorisierung erfolgreich',
        description: 'Mit Google verbunden',
        variant: 'success',
      });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      toast({
        title: 'Autorisierung fehlgeschlagen',
        description: decodeURIComponent(error),
        variant: 'destructive',
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google OAuth (Calendar & Tasks)</CardTitle>
        <CardDescription>Verbindung zu Google Kalender und Aufgaben</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Authorization Status */}
        <div className={cn(
          "flex items-center justify-between p-3 rounded-lg border",
          isAuthorized ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
        )}>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isAuthorized ? "bg-green-500" : "bg-gray-400"
            )} />
            <span className="text-sm font-medium">
              {isAuthorized ? 'Autorisiert' : 'Nicht autorisiert'}
            </span>
          </div>
        </div>

        <div>
          <Label htmlFor="oauth-client-id">Client ID</Label>
          <Input
            id="oauth-client-id"
            value={oauthData.clientId}
            onChange={(e) => {
              setOAuthData({ ...oauthData, clientId: e.target.value, tested: false });
            }}
            placeholder="123456789-abcdefg.apps.googleusercontent.com"
          />
        </div>

        <div>
          <Label htmlFor="oauth-client-secret">Client Secret</Label>
          <div className="flex gap-2">
            <Input
              id="oauth-client-secret"
              type={showSecret ? 'text' : 'password'}
              value={oauthData.clientSecret}
              onChange={(e) => {
                setOAuthData({ ...oauthData, clientSecret: e.target.value, tested: false });
              }}
              placeholder="GOCSPX-..."
            />
            <Button
              variant="outline"
              onClick={() => setShowSecret(!showSecret)}
              size="icon"
            >
              <FontAwesomeIcon icon={showSecret ? faEyeSlash : faEye} />
            </Button>
          </div>
        </div>

        {!isAuthorized ? (
          <Button onClick={handleAuthorize} disabled={!oauthData.clientId || !oauthData.clientSecret}>
            <FontAwesomeIcon icon={faExternalLinkAlt} className="mr-2" />
            Mit Google autorisieren
          </Button>
        ) : (
          <>
            <div>
              <Label htmlFor="calendar-select">
                <FontAwesomeIcon icon={faCalendar} className="mr-2" />
                Kalender
              </Label>
              <Select
                value={oauthData.calendarId}
                onValueChange={(value) => {
                  setOAuthData({ ...oauthData, calendarId: value });
                }}
              >
                <SelectTrigger id="calendar-select">
                  <SelectValue placeholder="Kalender wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {calendars.map((cal) => (
                    <SelectItem key={cal.id} value={cal.id}>
                      {cal.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="tasklist-select">
                <FontAwesomeIcon icon={faListUl} className="mr-2" />
                Aufgabenliste
              </Label>
              <Select
                value={oauthData.taskListId}
                onValueChange={(value) => {
                  setOAuthData({ ...oauthData, taskListId: value });
                }}
              >
                <SelectTrigger id="tasklist-select">
                  <SelectValue placeholder="Aufgabenliste wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {taskLists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <div className="flex gap-2 flex-wrap">
          {isAuthorized && (
            <>
              <Button onClick={loadResources} variant="outline" disabled={isLoadingResources}>
                <FontAwesomeIcon icon={isLoadingResources ? faSpinner : faCheckCircle} className={`mr-2 ${isLoadingResources ? 'animate-spin' : ''}`} />
                {isLoadingResources ? tCommon('loading') : t('reload')}
              </Button>
              <Button
                onClick={testOAuth}
                variant="outline"
                disabled={!oauthData.calendarId || !oauthData.taskListId || isTesting}
              >
                <FontAwesomeIcon icon={isTesting ? faSpinner : faCheckCircle} className={`mr-2 ${isTesting ? 'animate-spin' : ''}`} />
                {isTesting ? 'Teste...' : 'Test-Eintrag erstellen'}
              </Button>
              <Button
                onClick={handleAuthorize}
                variant="outline"
                className="border-[#27417A] text-[#27417A] hover:bg-[#F0F7FF]"
                disabled={!oauthData.clientId || !oauthData.clientSecret}
              >
                <FontAwesomeIcon icon={faRotate} className="mr-2" />
                Neu autorisieren
              </Button>
            </>
          )}
          <Button
            onClick={saveSettings}
            disabled={!oauthData.clientId || !oauthData.clientSecret || isSaving}
          >
            <FontAwesomeIcon icon={isSaving ? faSpinner : faSave} className={`mr-2 ${isSaving ? 'animate-spin' : ''}`} />
            {isSaving ? 'Speichert...' : t('save')}
          </Button>
          {oauthData.tested && (
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
