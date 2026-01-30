"use client"

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faArrowRight, faEye, faEyeSlash, faCheckCircle, faTimesCircle, faCopy, faKey, faLink, faSpinner } from '@fortawesome/free-solid-svg-icons';

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
  const [baseUrl, setBaseUrl] = useState('');

  const [testing, setTesting] = useState(false);
  const [connectionSuccess, setConnectionSuccess] = useState(false);
  const [testingWebhooks, setTestingWebhooks] = useState(false);
  const [webhooksExist, setWebhooksExist] = useState<boolean | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [creatingWorkflows, setCreatingWorkflows] = useState(false);

  useEffect(() => {
    // Auto-detect base URL for webhook instructions
    if (typeof window !== 'undefined') {
      const detectedUrl = `${window.location.protocol}//${window.location.host}`;
      setBaseUrl(detectedUrl);
    }

    // Check if already connected (from previous session)
    if (paperlessUrl && paperlessToken && webhookApiKey) {
      setConnectionSuccess(true);
    }
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setConnectionSuccess(false);

    try {
      const response = await fetch('/api/setup/test-paperless', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperlessUrl, paperlessToken })
      });

      const result = await response.json();
      console.log('Paperless connection test result:', result);

      if (response.ok) {
        setConnectionSuccess(true);

        // Set webhook API key from response
        if (result.webhookApiKey) {
          setWebhookApiKey(result.webhookApiKey);
          console.log('Webhook API key received:', result.webhookApiKey);
        }

        toast({
          title: 'Connection Successful',
          description: result.message || 'Successfully connected to Paperless-NGX',
        });

        // Automatically create workflows after successful connection
        setTimeout(async () => {
          await handleCreateWorkflows();
        }, 500);
      } else {
        console.error('Paperless connection error:', result);
        const errorMsg = result.error || 'Failed to connect to Paperless-NGX';
        const statusInfo = response.status ? ` (HTTP ${response.status})` : '';

        toast({
          title: 'Connection Failed',
          description: errorMsg + statusInfo,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Paperless connection exception:', error);
      toast({
        title: 'Connection Error',
        description: error.message || 'An error occurred while testing the connection',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const generateWebhookKey = async () => {
    setGeneratingKey(true);
    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 1,
          data: {
            generateWebhookKey: true,
          }
        }),
      });

      const result = await response.json();
      console.log('Webhook key generation response:', result);

      if (response.ok && result.webhookApiKey) {
        setWebhookApiKey(result.webhookApiKey);
        console.log('Webhook key set:', result.webhookApiKey);
      } else {
        console.error('Webhook key generation failed:', result);
        toast({
          title: 'Key Generation Failed',
          description: result.error || 'Failed to generate webhook API key',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to generate webhook key:', error);
      toast({
        title: 'Key Generation Error',
        description: 'An error occurred while generating the webhook key',
        variant: 'destructive',
      });
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleCreateWorkflows = async () => {
    setCreatingWorkflows(true);

    try {
      const response = await fetch('/api/webhooks/create-workflows', {
        method: 'POST',
      });

      const result = await response.json();
      console.log('Workflow creation result:', result);

      if (result.success) {
        const createdCount = result.created?.length || 0;
        const existingCount = result.existing?.length || 0;
        const totalCount = createdCount + existingCount;

        if (createdCount > 0) {
          toast({
            title: 'Workflows Created',
            description: `${createdCount} workflow(s) created successfully${existingCount > 0 ? `, ${existingCount} already existed` : ''}`,
          });
        } else {
          toast({
            title: 'Workflows Already Exist',
            description: `All ${existingCount} required workflows already exist`,
          });
        }

        // Automatically verify workflows after creation
        await handleTestWebhooks();
      } else {
        const failedCount = result.failed?.length || 0;
        toast({
          title: 'Workflow Creation Failed',
          description: `Failed to create ${failedCount} workflow(s). ${result.error || 'Please check the logs.'}`,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Workflow creation exception:', error);
      toast({
        title: 'Creation Error',
        description: error.message || 'An error occurred while creating workflows',
        variant: 'destructive',
      });
    } finally {
      setCreatingWorkflows(false);
    }
  };

  const handleTestWebhooks = async () => {
    setTestingWebhooks(true);
    setWebhooksExist(null);

    try {
      // First, check if webhooks exist
      const response = await fetch('/api/setup/test-webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperlessUrl, paperlessToken })
      });

      const result = await response.json();
      console.log('Webhooks test result:', result);

      if (response.ok && result.webhooksExist) {
        // Webhooks exist, now check API keys
        try {
          const apiKeyResponse = await fetch('/api/webhooks/validate');
          const apiKeyResult = await apiKeyResponse.json();
          console.log('Webhook API key validation:', apiKeyResult);

          if (apiKeyResult.valid) {
            setWebhooksExist(true);
            toast({
              title: 'Webhooks Configured',
              description: 'Webhooks are configured correctly with matching API keys',
            });
          } else {
            const invalidCount = apiKeyResult.workflows?.filter((w: any) => w.hasWebhook && !w.apiKeyMatch).length || 0;
            setWebhooksExist(false);
            toast({
              title: 'API Key Mismatch',
              description: `Webhooks found but ${invalidCount} workflow(s) have outdated API keys. Please update the x-api-key header in your workflows.`,
              variant: 'destructive',
            });
          }
        } catch (apiKeyError: any) {
          console.warn('Could not validate API keys:', apiKeyError);
          // Still consider webhooks valid if they exist, even if API key check fails
          setWebhooksExist(true);
          toast({
            title: 'Webhooks Found',
            description: 'Required webhooks are configured. API key validation skipped.',
          });
        }
      } else {
        setWebhooksExist(false);
        console.error('Webhooks test error:', result);
        const errorMsg = result.message || 'Please create the required webhooks in Paperless-NGX';
        const missingInfo = result.missingWebhooks?.length ? ` Missing: ${result.missingWebhooks.join(', ')}` : '';

        toast({
          title: 'Webhooks Not Found',
          description: errorMsg + missingInfo,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      setWebhooksExist(false);
      console.error('Webhooks test exception:', error);
      toast({
        title: 'Test Error',
        description: error.message || 'An error occurred while checking webhooks',
        variant: 'destructive',
      });
    } finally {
      setTestingWebhooks(false);
    }
  };

  const handleCopyWebhookKey = () => {
    if (webhookApiKey) {
      navigator.clipboard.writeText(webhookApiKey);
      toast({
        title: 'Copied',
        description: 'Webhook API key copied to clipboard',
      });
    }
  };

  const handleCopyWebhookUrl = (type: 'added' | 'updated') => {
    const url = `${baseUrl}/api/webhook/paperless-${type}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Copied',
      description: 'Webhook URL copied to clipboard',
    });
  };

  const handleNext = () => {
    if (!connectionSuccess) {
      toast({
        title: 'Connection Required',
        description: 'Please test the Paperless-NGX connection first',
        variant: 'destructive',
      });
      return;
    }

    if (!webhookApiKey) {
      toast({
        title: 'Webhook Key Missing',
        description: 'Webhook API key is required. Please try refreshing the page.',
        variant: 'destructive',
      });
      return;
    }

    if (webhooksExist !== true) {
      toast({
        title: 'Webhooks Required',
        description: 'Please configure and verify the webhooks in Paperless-NGX',
        variant: 'destructive',
      });
      return;
    }

    onNext({ paperlessUrl, paperlessToken, webhookApiKey });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-accent mb-2">
          Step 1: Paperless-NGX Connection
        </h2>
        <p className="text-gray-600">
          Connect to your Paperless-NGX instance to enable document processing.
        </p>
      </div>

      {/* Connection Form - only show if not connected yet */}
      {!connectionSuccess && (
        <>
          {/* Paperless URL */}
          <div className="space-y-2">
            <Label htmlFor="paperlessUrl">
              Paperless-NGX URL <span className="text-red-500">*</span>
            </Label>
            <Input
              id="paperlessUrl"
              type="url"
              placeholder="https://paperless.example.com"
              value={paperlessUrl}
              onChange={(e) => setPaperlessUrl(e.target.value)}
            />
            <p className="text-sm text-gray-500">
              The URL of your Paperless-NGX installation
            </p>
          </div>

          {/* Paperless Token */}
          <div className="space-y-2">
            <Label htmlFor="paperlessToken">
              Admin API Token <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="paperlessToken"
                type={showToken ? 'text' : 'password'}
                placeholder="••••••••••••••••••••"
                value={paperlessToken}
                onChange={(e) => setPaperlessToken(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                <FontAwesomeIcon icon={showToken ? faEyeSlash : faEye} />
              </button>
            </div>
            <p className="text-sm text-gray-500">
              Your Paperless-NGX admin API token (Settings → API)
            </p>
          </div>

          {/* Test Connection */}
          <div className="flex gap-4">
            <Button
              onClick={handleTestConnection}
              disabled={!paperlessUrl || !paperlessToken || testing}
              variant="outline"
              className="flex-1"
            >
              <FontAwesomeIcon icon={testing ? faSpinner : faCheckCircle} className={`mr-2 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>
        </>
      )}

      {/* Connection Success Summary */}
      {connectionSuccess && (
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <FontAwesomeIcon icon={faCheckCircle} className="text-green-600 text-xl" />
            <div>
              <h3 className="font-semibold text-green-900">Connected to Paperless-NGX</h3>
              <p className="text-sm text-green-700">{paperlessUrl}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Webhook Setup Instructions - only show after connection success */}
      {connectionSuccess && (
        <>
          <Card className="p-4 bg-accent/5 border-accent/20">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-accent mb-2 flex items-center gap-2">
                  <FontAwesomeIcon icon={faKey} />
                  Webhook API Key
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Use this key to authenticate webhook calls from Paperless to pAIperless.
                </p>
                {generatingKey ? (
                  <div className="text-sm text-gray-500">Generating API key...</div>
                ) : webhookApiKey ? (
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={webhookApiKey}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      onClick={handleCopyWebhookKey}
                      size="sm"
                      variant="outline"
                    >
                      <FontAwesomeIcon icon={faCopy} />
                    </Button>
                  </div>
                ) : (
                  <div className="text-sm text-red-600">Failed to generate API key</div>
                )}
              </div>
            </div>
          </Card>

          {webhookApiKey && (
            <>
              <Card className="p-4 bg-blue-50 border-blue-200">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                      <FontAwesomeIcon icon={faLink} />
                      Configure Webhooks in Paperless-NGX
                    </h3>
                    <p className="text-sm text-blue-800 mb-3">
                      <strong>Option 1 (Recommended):</strong> Click "Auto-Create Workflows" below to automatically create the required webhooks.
                    </p>
                    <p className="text-sm text-blue-800 mb-3">
                      <strong>Option 2 (Manual):</strong> Create two webhooks manually in Paperless-NGX (Settings → Workflows):
                    </p>
                  </div>

                  {/* Webhook 1 */}
                  <div className="bg-white p-3 rounded border border-blue-200">
                    <h4 className="font-semibold text-sm mb-2">1. Document Added Webhook</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-600">Name:</span> <code className="bg-gray-100 px-2 py-1 rounded">paiperless_document_added</code>
                      </div>
                      <div>
                        <span className="text-gray-600">Trigger:</span> Document added
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">URL:</span>
                        <code className="bg-gray-100 px-2 py-1 rounded flex-1 text-xs">{baseUrl}/api/webhook/paperless-added</code>
                        <Button
                          onClick={() => handleCopyWebhookUrl('added')}
                          size="sm"
                          variant="ghost"
                        >
                          <FontAwesomeIcon icon={faCopy} />
                        </Button>
                      </div>
                      <div>
                        <span className="text-gray-600">Header:</span> <code className="bg-gray-100 px-2 py-1 rounded">x-api-key: {webhookApiKey.substring(0, 16)}...</code>
                      </div>
                    </div>
                  </div>

                  {/* Webhook 2 */}
                  <div className="bg-white p-3 rounded border border-blue-200">
                    <h4 className="font-semibold text-sm mb-2">2. Document Updated Webhook</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-600">Name:</span> <code className="bg-gray-100 px-2 py-1 rounded">paiperless_document_updated</code>
                      </div>
                      <div>
                        <span className="text-gray-600">Trigger:</span> Document updated
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">URL:</span>
                        <code className="bg-gray-100 px-2 py-1 rounded flex-1 text-xs">{baseUrl}/api/webhook/paperless-updated</code>
                        <Button
                          onClick={() => handleCopyWebhookUrl('updated')}
                          size="sm"
                          variant="ghost"
                        >
                          <FontAwesomeIcon icon={faCopy} />
                        </Button>
                      </div>
                      <div>
                        <span className="text-gray-600">Header:</span> <code className="bg-gray-100 px-2 py-1 rounded">x-api-key: {webhookApiKey.substring(0, 16)}...</code>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Create & Test Webhooks */}
              <div className="flex gap-4">
                <Button
                  onClick={handleCreateWorkflows}
                  disabled={creatingWorkflows || testingWebhooks}
                  variant="default"
                  className="flex-1"
                >
                  <FontAwesomeIcon icon={creatingWorkflows ? faSpinner : faCheckCircle} className={`mr-2 ${creatingWorkflows ? 'animate-spin' : ''}`} />
                  {creatingWorkflows ? 'Creating...' : 'Auto-Create Workflows'}
                </Button>
                <Button
                  onClick={handleTestWebhooks}
                  disabled={testingWebhooks || creatingWorkflows}
                  variant="outline"
                  className="flex-1"
                >
                  <FontAwesomeIcon icon={testingWebhooks ? faSpinner : faCheckCircle} className={`mr-2 ${testingWebhooks ? 'animate-spin' : ''}`} />
                  {testingWebhooks ? 'Testing...' : 'Verify Webhooks'}
                </Button>
                {webhooksExist === true && (
                  <div className="flex items-center gap-2 text-green-600">
                    <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />
                    <span className="text-sm">Configured</span>
                  </div>
                )}
                {webhooksExist === false && (
                  <div className="flex items-center gap-2 text-red-600">
                    <FontAwesomeIcon icon={faTimesCircle} className="text-red-600" />
                    <span className="text-sm">Not Found</span>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-6">
        <Button onClick={onBack} variant="outline">
          <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
          Back
        </Button>

        <Button
          onClick={handleNext}
          disabled={!connectionSuccess || !webhookApiKey || webhooksExist !== true}
        >
          Next
          <FontAwesomeIcon icon={faArrowRight} className="ml-2" />
        </Button>
      </div>
    </div>
  );
}
