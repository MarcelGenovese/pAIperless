"use client"

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, CheckCircle2, XCircle, Loader2, ExternalLink, Calendar, ListTodo } from 'lucide-react';

interface StepProps {
  onNext: (data: Record<string, any>) => void;
  onBack: () => void;
  data: Record<string, any>;
}

export default function Step4GoogleOAuth({ onNext, onBack, data }: StepProps) {
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

      // Get OAuth URL
      const response = await fetch('/api/auth/google/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientSecret }),
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
    try {
      const response = await fetch('/api/auth/google/resources');
      const result = await response.json();

      if (response.ok) {
        setCalendars(result.calendars || []);
        setTaskLists(result.taskLists || []);

        // Auto-select primary calendar and first task list
        if (result.calendars && result.calendars.length > 0 && !selectedCalendar) {
          const primary = result.calendars.find((cal: any) => cal.primary);
          setSelectedCalendar(primary?.id || result.calendars[0].id);
        }
        if (result.taskLists && result.taskLists.length > 0 && !selectedTaskList) {
          setSelectedTaskList(result.taskLists[0].id);
        }
      } else {
        toast({
          title: "Failed to Load Resources",
          description: result.error || "Could not load calendars and task lists.",
          variant: "destructive",
        });
      }
    } catch (error) {
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
          <h2 className="text-2xl font-bold text-primary mb-2">
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

          {/* OAuth Button */}
          {!isAuthorized ? (
            <div className="flex flex-col gap-2 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <XCircle className="h-4 w-4 text-red-600" />
                Not authorized yet
              </div>
              <Button
                onClick={handleStartOAuth}
                disabled={!clientId || !clientSecret}
                className="w-full"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Authorize with Google
              </Button>
              <p className="text-xs text-muted-foreground">
                You'll be redirected to Google to grant access to Calendar and Tasks.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-4 border rounded-lg bg-green-50">
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                Successfully authorized with Google
              </div>
            </div>
          )}

          {/* Calendar and Task List Selection */}
          {isAuthorized && (
            <>
              {isLoadingCalendars ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2">Loading calendars and task lists...</span>
                </div>
              ) : (
                <>
                  {/* Calendar Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="calendar">
                      <Calendar className="inline h-4 w-4 mr-2" />
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
                      <ListTodo className="inline h-4 w-4 mr-2" />
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

        <div className="flex justify-between pt-6">
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleNext} disabled={!canProceed}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
