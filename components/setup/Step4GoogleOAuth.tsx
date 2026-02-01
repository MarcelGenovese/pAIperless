"use client"

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faArrowRight, faEye, faEyeSlash, faCheckCircle, faTimesCircle, faCopy, faKey, faSpinner, faUpload, faFileText, faExternalLinkAlt, faCalendar, faListUl, faEnvelope, faServer, faCog } from '@fortawesome/free-solid-svg-icons';
import { useTranslations } from 'next-intl';

interface StepProps {
  onNext: (data: Record<string, any>) => void;
  onBack: () => void;
  data: Record<string, any>;
}

export default function Step4GoogleOAuth({ onNext, onBack, data }: StepProps) {
  const t = useTranslations('setup');

  const { toast } = useToast();

  const [clientId, setClientId] = useState(data.googleOAuthClientId || '');
  const [clientSecret, setClientSecret] = useState(data.googleOAuthClientSecret || '');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [calendars, setCalendars] = useState<Array<{ id: string; name: string }>>([]);
  const [taskLists, setTaskLists] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCalendar, setSelectedCalendar] = useState(data.googleCalendarId || '');
  const [selectedTaskList, setSelectedTaskList] = useState(data.googleTaskListId || '');

  const canProceed = clientId && clientSecret && isAuthorized && selectedCalendar && selectedTaskList;

  const handleSkip = async () => {
    try {
      // Save as not configured
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 4,
          data: {
            clientId: '',
            clientSecret: '',
            calendarId: '',
            taskListId: ''
          }
        }),
      });

      toast({
        title: t('google_oauth_uebersprungen'),
        description: t('sie_koennen_google_calendar_tasks_spaeter_in_den_e'),
      });

      onNext({});
    } catch (error) {
      toast({
        title: t('fehler'),
        description: t('konfiguration_konnte_nicht_gespeichert_werden'),
        variant: "destructive",
      });
    }
  };

  // Load saved OAuth config on mount
  useEffect(() => {
    const loadOAuthConfig = async () => {
      try {
        const response = await fetch('/api/setup/oauth-config');
        if (response.ok) {
          const config = await response.json();
          console.log('Loaded OAuth config:', config);
          if (config.clientId) setClientId(config.clientId);
          if (config.clientSecret) setClientSecret(config.clientSecret);
          if (config.calendarId) setSelectedCalendar(config.calendarId);
          if (config.taskListId) setSelectedTaskList(config.taskListId);

          // Check if already authorized by trying to fetch resources
          if (config.clientId && config.clientSecret) {
            const resourcesResponse = await fetch('/api/auth/google/resources');
            if (resourcesResponse.ok) {
              setIsAuthorized(true);
              const resources = await resourcesResponse.json();
              if (resources.calendars) setCalendars(resources.calendars);
              if (resources.taskLists) setTaskLists(resources.taskLists);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load OAuth config:', error);
      }
    };
    loadOAuthConfig();
  }, []);

  // Debug logging
  useEffect(() => {
    console.log('Step4 canProceed check:', {
      clientId: !!clientId,
      clientSecret: !!clientSecret,
      isAuthorized,
      selectedCalendar,
      selectedTaskList,
      canProceed
    });
  }, [clientId, clientSecret, isAuthorized, selectedCalendar, selectedTaskList, canProceed]);

  useEffect(() => {
    // Check if we're returning from OAuth callback
    const params = new URLSearchParams(window.location.search);
    const success = params.get('oauth_success');
    const error = params.get('oauth_error');

    if (success === 'true') {
      setIsAuthorized(true);
      loadCalendarsAndTasks();
      toast({
        title: "Authorization Successful",
        description: "Successfully connected to Google Calendar and Tasks.",
      });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      toast({
        title: "Authorization Failed",
        description: decodeURIComponent(error),
        variant: "destructive",
      });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleStartOAuth = async () => {
    if (!clientId || !clientSecret) {
      toast({
        title: "Missing Credentials",
        description: "Please enter both Client ID and Client Secret.",
        variant: "destructive",
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
            clientId,
            clientSecret,
          }
        }),
      });

      // Get OAuth URL with state parameter for step tracking
      const response = await fetch('/api/auth/google/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          clientSecret,
          state: '4' // Current step
        }),
      });

      const result = await response.json();

      if (response.ok && result.url) {
        // Open OAuth flow in same window
        window.location.href = result.url;
      } else {
        toast({
          title: "OAuth Error",
          description: result.error || "Failed to start OAuth flow.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initiate OAuth flow.",
        variant: "destructive",
      });
    }
  };

  const loadCalendarsAndTasks = async () => {
    setIsLoadingCalendars(true);
    console.log('Loading calendars and tasks...');
    try {
      const response = await fetch('/api/auth/google/resources');
      console.log('Resources response status:', response.status);
      const result = await response.json();
      console.log('Resources result:', result);

      if (response.ok) {
        setCalendars(result.calendars || []);
        setTaskLists(result.taskLists || []);
        console.log('Calendars loaded:', result.calendars?.length || 0);
        console.log('Task lists loaded:', result.taskLists?.length || 0);

        // Auto-select primary calendar and first task list
        if (result.calendars && result.calendars.length > 0) {
          const primary = result.calendars.find((cal: any) => cal.primary);
          const selectedId = primary?.id || result.calendars[0].id;
          console.log('Auto-selecting calendar:', selectedId);
          setSelectedCalendar(selectedId);
        }
        if (result.taskLists && result.taskLists.length > 0) {
          const selectedId = result.taskLists[0].id;
          console.log('Auto-selecting task list:', selectedId);
          setSelectedTaskList(selectedId);
        }
      } else {
        console.error('Failed to load resources:', result.error);
        toast({
          title: "Failed to Load Resources",
          description: result.error || "Could not load calendars and task lists.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading resources:', error);
      toast({
        title: "Error",
        description: "An error occurred while loading resources.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCalendars(false);
    }
  };

  const handleNext = async () => {
    if (!canProceed) return;

    try {
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 4,
          data: {
            clientId,
            clientSecret,
            calendarId: selectedCalendar,
            taskListId: selectedTaskList,
          }
        }),
      });

      onNext({});
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save OAuth configuration.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-accent mb-2">
            Step 4: Google Calendar & Tasks
          </h2>
          <p className="text-muted-foreground">
            Connect to Google Calendar and Tasks to create reminders for documents requiring action.
          </p>
        </div>

        <div className="space-y-4">
          {/* Client ID */}
          <div className="space-y-2">
            <Label htmlFor="clientId">OAuth Client ID</Label>
            <Input
              id="clientId"
              type="text"
              placeholder="123456789-abc.apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={isAuthorized}
            />
            <p className="text-xs text-muted-foreground">
              Your Google OAuth 2.0 Client ID from Google Cloud Console.
            </p>
          </div>

          {/* Client Secret */}
          <div className="space-y-2">
            <Label htmlFor="clientSecret">OAuth Client Secret</Label>
            <Input
              id="clientSecret"
              type="password"
              placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxxx"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              disabled={isAuthorized}
            />
            <p className="text-xs text-muted-foreground">
              Your Google OAuth 2.0 Client Secret.
            </p>
          </div>

          {/* Redirect URI Info */}
          <div className="space-y-2 p-4 border rounded-lg bg-blue-50 dark:bg-[hsl(0,0%,15%)]">
            <Label className="text-blue-900 dark:text-blue-100">
              <FontAwesomeIcon icon={faExternalLinkAlt} className="mr-2" />
              Autorisierte Weiterleitungs-URI
            </Label>
            <div className="flex gap-2">
              <Input
                value={typeof window !== 'undefined' ? `${window.location.origin}/api/auth/google/callback` : ''}
                readOnly
                className="font-mono text-sm bg-white dark:bg-gray-800"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (typeof window !== 'undefined') {
                    try {
                      await navigator.clipboard.writeText(`${window.location.origin}/api/auth/google/callback`);
                      toast({
                        title: "Kopiert!",
                        description: t('redirect_uri_wurde_in_die_zwischenablage_kopiert'),
                      });
                    } catch (error) {
                      toast({
                        title: t('fehler'),
                        description: t('kopieren_fehlgeschlagen_bitte_manuell_kopieren'),
                        variant: "destructive",
                      });
                    }
                  }
                }}
              >
                <FontAwesomeIcon icon={faCopy} />
              </Button>
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Diese URL muss in der Google Cloud Console unter <strong>APIs & Dienste → Anmeldedaten → OAuth 2.0-Client-IDs</strong>{t('bei_den')}<strong>Autorisierten Weiterleitungs-URIs</strong> eingetragen werden.
            </p>
          </div>

          {/* OAuth Button */}
          {!isAuthorized ? (
            <div className="flex flex-col gap-2 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FontAwesomeIcon icon={faTimesCircle} className="text-red-600" />
                Not authorized yet
              </div>
              <Button
                onClick={handleStartOAuth}
                disabled={!clientId || !clientSecret}
                className="w-full"
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} className="mr-2" />
                Authorize with Google
              </Button>
              <p className="text-xs text-muted-foreground">
                You will be redirected to Google to grant access to Calendar and Tasks.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-4 border border-green-200 dark:border-[hsl(120,30%,25%)] rounded-lg bg-green-50 dark:bg-[hsl(120,30%,15%)]">
              <div className="flex items-center gap-2 text-sm text-green-700">
                <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />
                Successfully authorized with Google
              </div>
            </div>
          )}

          {/* Calendar and Task List Selection */}
          {isAuthorized && (
            <>
              {isLoadingCalendars ? (
                <div className="flex items-center justify-center p-8">
                  <FontAwesomeIcon icon={faSpinner} spin />
                  <span className="ml-2">Loading calendars and task lists...</span>
                </div>
              ) : (
                <>
                  {/* Calendar Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="calendar">
                      <FontAwesomeIcon icon={faCalendar} />
                      Select Calendar
                    </Label>
                    <Select value={selectedCalendar} onValueChange={setSelectedCalendar}>
                      <SelectTrigger id="calendar">
                        <SelectValue placeholder="Choose a calendar" />
                      </SelectTrigger>
                      <SelectContent>
                        {calendars.map((calendar) => (
                          <SelectItem key={calendar.id} value={calendar.id}>
                            {calendar.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Events with action reminders will be created in this calendar.
                    </p>
                  </div>

                  {/* Task List Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="taskList">
                      <FontAwesomeIcon icon={faListUl} />
                      Select Task List
                    </Label>
                    <Select value={selectedTaskList} onValueChange={setSelectedTaskList}>
                      <SelectTrigger id="taskList">
                        <SelectValue placeholder="Choose a task list" />
                      </SelectTrigger>
                      <SelectContent>
                        {taskLists.map((list) => (
                          <SelectItem key={list.id} value={list.id}>
                            {list.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Tasks for required actions will be created in this list.
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex justify-between items-center pt-6">
          <Button onClick={onBack} variant="outline">
            <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
            Back
          </Button>

          <div className="flex gap-3">
            <Button onClick={handleSkip} variant="ghost">
              Skip (Optional)
            </Button>
            <Button onClick={handleNext} disabled={!canProceed}>
              Next
              <FontAwesomeIcon icon={faArrowRight} className="ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
