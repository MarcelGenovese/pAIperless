"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle,
  faFileUpload,
  faBolt,
  faChartLine,
  faTimesCircle,
  faEnvelope,
  faServer
} from '@fortawesome/free-solid-svg-icons';
import { useToast } from '@/hooks/use-toast';

interface Step9CompleteProps {
  data: Record<string, any>;
}

export default function Step9Complete({ data }: Step9CompleteProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAllConfig = async () => {
      try {
        const results = await Promise.all([
          fetch('/api/setup/load-config?step=1').then(r => r.json()),
          fetch('/api/setup/load-config?step=2').then(r => r.json()),
          fetch('/api/setup/load-config?step=3').then(r => r.json()),
          fetch('/api/setup/load-config?step=4').then(r => r.json()),
          fetch('/api/setup/load-config?step=5').then(r => r.json()),
          fetch('/api/setup/load-config?step=6').then(r => r.json()),
          fetch('/api/setup/load-config?step=8').then(r => r.json()),
        ]);

        setConfig({
          paperless: results[0],
          gemini: results[1],
          documentAI: results[2],
          oauth: results[3],
          email: results[4],
          integration: results[5],
          ftp: results[6],
        });
      } catch (error) {
        console.error('Failed to load config:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAllConfig();
  }, []);

  const handleComplete = async () => {
    try {
      // Mark setup as complete
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 9,
          data: {}
        })
      });

      toast({
        title: 'Setup Complete!',
        description: 'Starting services...',
        variant: 'success',
      });

      // Start all services with new configuration
      try {
        await fetch('/api/services/restart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ service: 'all' }),
        });

        toast({
          title: 'Services Started',
          description: 'FTP server and worker are now running.',
          variant: 'success',
        });
      } catch (serviceError) {
        console.error('Failed to start services:', serviceError);
        // Don't block completion if service start fails
      }

      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to complete setup',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto text-center">
      <div className="mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
          <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-accent mb-2">
          Setup Complete!
        </h2>
        <p className="text-lg text-muted-foreground">
          Your pAIperless instance is now configured and ready to use.
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Configuration Summary</CardTitle>
        </CardHeader>
        <CardContent className="text-left space-y-2">
          {/* Paperless-NGX */}
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium">Paperless-NGX</span>
            <span className="text-sm text-green-600 flex items-center gap-1">
              <FontAwesomeIcon icon={faCheckCircle} />
              {config.paperless?.paperlessUrl && new URL(config.paperless.paperlessUrl).hostname}
            </span>
          </div>

          {/* Gemini AI */}
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium">Gemini AI</span>
            <span className="text-sm text-green-600 flex items-center gap-1">
              <FontAwesomeIcon icon={faCheckCircle} />
              {config.gemini?.geminiModel || 'Configured'}
            </span>
          </div>

          {/* Document AI */}
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium">Document AI (OCR)</span>
            {config.documentAI?.projectId && config.documentAI?.processorId ? (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <FontAwesomeIcon icon={faCheckCircle} />
                {config.documentAI.enabled === 'true' ? 'Enabled' : 'Configured'}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <FontAwesomeIcon icon={faTimesCircle} />
                Skipped
              </span>
            )}
          </div>

          {/* Google OAuth */}
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium">Google Calendar & Tasks</span>
            {config.oauth?.clientId && config.oauth?.clientSecret ? (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <FontAwesomeIcon icon={faCheckCircle} />
                Configured
              </span>
            ) : (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <FontAwesomeIcon icon={faTimesCircle} />
                Skipped
              </span>
            )}
          </div>

          {/* Email Notifications */}
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium">Email Notifications</span>
            {config.email?.emailEnabled ? (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <FontAwesomeIcon icon={faCheckCircle} />
                {config.email.smtpServer}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <FontAwesomeIcon icon={faTimesCircle} />
                Disabled
              </span>
            )}
          </div>

          {/* Tags & Fields */}
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium">Paperless Tags</span>
            <span className="text-sm text-green-600 flex items-center gap-1">
              <FontAwesomeIcon icon={faCheckCircle} />
              {config.integration?.tagAiTodo || 'ai_todo'}, {config.integration?.tagActionRequired || 'action_required'}
            </span>
          </div>

          {/* FTP Server */}
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium">FTP Server</span>
            {config.ftp?.ftpEnabled ? (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <FontAwesomeIcon icon={faCheckCircle} />
                Port {config.ftp.ftpPort}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <FontAwesomeIcon icon={faTimesCircle} />
                Disabled
              </span>
            )}
          </div>

          {/* Worker */}
          <div className="flex justify-between items-center py-2">
            <span className="text-sm font-medium">File Watcher</span>
            <span className="text-sm text-green-600 flex items-center gap-1">
              <FontAwesomeIcon icon={faCheckCircle} />
              Ready
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Button onClick={handleComplete} size="lg" className="w-full">
          Go to Dashboard
        </Button>

        <p className="text-sm text-muted-foreground">
          You can access settings anytime to modify your configuration
        </p>
      </div>

      <div className="mt-12 grid md:grid-cols-3 gap-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-[hsl(0,0%,18%)] mb-3">
            <FontAwesomeIcon icon={faFileUpload} className="text-3xl text-blue-600" />
          </div>
          <h3 className="font-semibold mb-1">Drop Files</h3>
          <p className="text-sm text-muted-foreground">
            Place PDFs in the consume folder
          </p>
        </div>
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-950 mb-3">
            <FontAwesomeIcon icon={faBolt} className="text-3xl text-green-600" />
          </div>
          <h3 className="font-semibold mb-1">Auto-Process</h3>
          <p className="text-sm text-muted-foreground">
            OCR, tagging, and analysis automatically
          </p>
        </div>
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-950 mb-3">
            <FontAwesomeIcon icon={faChartLine} className="text-3xl text-purple-600" />
          </div>
          <h3 className="font-semibold mb-1">Monitor</h3>
          <p className="text-sm text-muted-foreground">
            Track progress in the dashboard
          </p>
        </div>
      </div>
    </div>
  );
}
