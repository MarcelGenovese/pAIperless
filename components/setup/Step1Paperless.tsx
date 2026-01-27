"use client"

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, ArrowRight, Eye, EyeOff, CheckCircle2, XCircle, Copy } from 'lucide-react';

interface Step1PaperlessProps {
  onNext: (data: Record<string, any>) => void;
  onBack: () => void;
  data: Record<string, any>;
}

export default function Step1Paperless({ onNext, onBack, data }: Step1PaperlessProps) {
  const t = useTranslations('setup');
  const { toast } = useToast();

  const [paperlessUrl, setPaperlessUrl] = useState(data.paperlessUrl || '');
  const [paperlessToken, setPaperlessToken] = useState(data.paperlessToken || '');
  const [showToken, setShowToken] = useState(false);
  const [webhookApiKey, setWebhookApiKey] = useState(data.webhookApiKey || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [generating, setGenerating] = useState(false);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/setup/test-paperless', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperlessUrl, paperlessToken })
      });

      const result = await response.json();

      if (response.ok) {
        setTestResult('success');
        toast({
          title: t('connectionSuccess'),
          description: result.message,
          variant: 'success',
        });
      } else {
        setTestResult('error');
        toast({
          title: t('connectionFailed'),
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      setTestResult('error');
      toast({
        title: t('connectionFailed'),
        description: 'Network error',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleGenerateWebhookKey = async () => {
    setGenerating(true);

    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 1,
          data: { generateWebhookKey: true }
        })
      });

      const result = await response.json();

      if (response.ok) {
        setWebhookApiKey(result.webhookApiKey);
        toast({
          title: 'Webhook API Key Generated',
          description: 'Copy this key for your Paperless workflows',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate webhook key',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(webhookApiKey);
    toast({
      title: 'Copied!',
      description: 'Webhook API key copied to clipboard',
    });
  };

  const handleNext = async () => {
    if (!paperlessUrl || !paperlessToken) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (testResult !== 'success') {
      toast({
        title: 'Connection Not Tested',
        description: 'Please test the connection before continuing',
        variant: 'destructive',
      });
      return;
    }

    // Save to database
    try {
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 1,
          data: { paperlessUrl, paperlessToken }
        })
      });

      onNext({ paperlessUrl, paperlessToken, webhookApiKey });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid md:grid-cols-[2fr,1fr] gap-8">
        {/* Left Column: Form */}
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-primary mb-2">
              {t('step1Title')}
            </h2>
            <p className="text-muted-foreground">
              {t('step1Description')}
            </p>
          </div>

          {/* Paperless URL */}
          <div className="space-y-2">
            <Label htmlFor="paperlessUrl">
              {t('paperlessUrl')} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="paperlessUrl"
              type="url"
              value={paperlessUrl}
              onChange={(e) => setPaperlessUrl(e.target.value)}
              placeholder="https://paperless.example.com"
            />
          </div>

          {/* Paperless Token */}
          <div className="space-y-2">
            <Label htmlFor="paperlessToken">
              {t('paperlessToken')} <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="paperlessToken"
                type={showToken ? 'text' : 'password'}
                value={paperlessToken}
                onChange={(e) => setPaperlessToken(e.target.value)}
                placeholder="abc123..."
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleTestConnection}
              variant="outline"
              disabled={!paperlessUrl || !paperlessToken || testing}
            >
              {testing ? 'Testing...' : t('testConnection')}
            </Button>

            {testResult === 'success' && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">Connected</span>
              </div>
            )}

            {testResult === 'error' && (
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Failed</span>
              </div>
            )}
          </div>

          {/* Webhook API Key */}
          {testResult === 'success' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('webhookApiKey')}</CardTitle>
                <CardDescription>{t('webhookApiKeyDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!webhookApiKey ? (
                  <Button
                    onClick={handleGenerateWebhookKey}
                    variant="outline"
                    disabled={generating}
                  >
                    {generating ? 'Generating...' : 'Generate Webhook Key'}
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      value={webhookApiKey}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      onClick={handleCopyKey}
                      variant="outline"
                      size="icon"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {webhookApiKey && (
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p className="font-medium">{t('webhookInstructions')}</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li className="text-xs">{t('webhookWorkflow1')}</li>
                      <li className="text-xs">{t('webhookWorkflow2')}</li>
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6">
            <Button onClick={onBack} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('back')}
            </Button>

            <Button
              onClick={handleNext}
              disabled={testResult !== 'success' || !webhookApiKey}
            >
              {t('next')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Right Column: Video & Description */}
        <div className="space-y-4">
          <div className="rounded-lg bg-gray-100 aspect-video flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Video Tutorial</p>
          </div>
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">How to get your Paperless API token:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Log into Paperless-NGX</li>
              <li>Go to Settings → API</li>
              <li>Create or copy your admin token</li>
              <li>Paste it here</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
