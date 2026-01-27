"use client"

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faArrowRight, faEye, faEyeSlash, faCheckCircle, faTimesCircle, faCopy, faKey, faSpinner, faUpload, faFileText, faExternalLinkAlt, faCalendar, faListUl, faEnvelope, faServer, faCog } from '@fortawesome/free-solid-svg-icons';

interface Step2GeminiProps {
  onNext: (data: Record<string, any>) => void;
  onBack: () => void;
  data: Record<string, any>;
}

interface GeminiModel {
  name: string;
  displayName: string;
  description?: string;
}

export default function Step2Gemini({ onNext, onBack, data }: Step2GeminiProps) {
  const t = useTranslations('setup');
  const { toast } = useToast();

  const [geminiApiKey, setGeminiApiKey] = useState(data.geminiApiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState(data.geminiModel || 'gemini-2.0-flash-exp');
  const [models, setModels] = useState<GeminiModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testResponse, setTestResponse] = useState('');

  // Load available models when API key is entered
  useEffect(() => {
    if (geminiApiKey.length > 20) {
      loadModels();
    }
  }, [geminiApiKey]);

  const loadModels = async () => {
    setLoadingModels(true);

    try {
      const response = await fetch('/api/setup/gemini-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: geminiApiKey })
      });

      const result = await response.json();

      if (response.ok) {
        setModels(result.models);

        // Auto-select recommended model if available
        const recommendedModel = result.models.find(
          (m: GeminiModel) => m.name.includes('flash') || m.name.includes('2.0')
        );

        if (recommendedModel && !selectedModel) {
          setSelectedModel(recommendedModel.name);
        }
      } else {
        toast({
          title: 'Failed to load models',
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleTestGemini = async () => {
    setTesting(true);
    setTestResult(null);
    setTestResponse('');

    try {
      const response = await fetch('/api/setup/test-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: geminiApiKey,
          model: selectedModel
        })
      });

      const result = await response.json();

      if (response.ok) {
        setTestResult('success');
        setTestResponse(result.response);
        toast({
          title: t('geminiTestSuccess'),
          description: 'Gemini API is working correctly',
          variant: 'success',
        });
      } else {
        setTestResult('error');
        toast({
          title: t('geminiTestFailed'),
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      setTestResult('error');
      toast({
        title: t('geminiTestFailed'),
        description: 'Network error',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleNext = async () => {
    if (!geminiApiKey || !selectedModel) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (testResult !== 'success') {
      toast({
        title: 'API Not Tested',
        description: 'Please test the Gemini API before continuing',
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
          step: 2,
          data: { geminiApiKey, geminiModel: selectedModel }
        })
      });

      onNext({ geminiApiKey, geminiModel: selectedModel });
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
              {t('step2Title')}
            </h2>
            <p className="text-muted-foreground">
              {t('step2Description')}
            </p>
          </div>

          {/* Gemini API Key */}
          <div className="space-y-2">
            <Label htmlFor="geminiApiKey">
              {t('geminiApiKey')} <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="geminiApiKey"
                type={showApiKey ? 'text' : 'password'}
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <FontAwesomeIcon icon={faEyeSlash} /> : <FontAwesomeIcon icon={faEye} />}
              </button>
            </div>
            {loadingModels && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <FontAwesomeIcon icon={faSpinner} spin />
                Loading available models...
              </p>
            )}
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <Label htmlFor="model">
              {t('geminiModel')} <span className="text-red-500">*</span>
            </Label>
            <Select
              value={selectedModel}
              onValueChange={setSelectedModel}
              disabled={models.length === 0}
            >
              <SelectTrigger id="model">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {models.length === 0 ? (
                  <SelectItem value="gemini-2.0-flash-exp">
                    gemini-2.0-flash-exp (Recommended)
                  </SelectItem>
                ) : (
                  models.map((model) => (
                    <SelectItem key={model.name} value={model.name}>
                      {model.displayName}
                      {model.name.includes('flash') && ' (Recommended)'}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Flash models offer the best price-performance ratio for document processing
            </p>
          </div>

          {/* Test Button */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleTestGemini}
              variant="outline"
              disabled={!geminiApiKey || !selectedModel || testing}
            >
              {testing ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin />
                  Testing...
                </>
              ) : (
                t('testGemini')
              )}
            </Button>

            {testResult === 'success' && (
              <div className="flex items-center gap-2 text-green-600">
                <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />
                <span className="text-sm font-medium">API Working</span>
              </div>
            )}

            {testResult === 'error' && (
              <div className="flex items-center gap-2 text-red-600">
                <FontAwesomeIcon icon={faTimesCircle} className="text-red-600" />
                <span className="text-sm font-medium">Test Failed</span>
              </div>
            )}
          </div>

          {/* Test Response */}
          {testResponse && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test Response</CardTitle>
                <CardDescription>Gemini successfully generated this response</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground italic">
                  "{testResponse}"
                </p>
              </CardContent>
            </Card>
          )}

          {/* Model Info */}
          {selectedModel && (
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg">Selected Model Info</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div>
                  <span className="font-medium">Model:</span> {selectedModel}
                </div>
                <div>
                  <span className="font-medium">Best for:</span> Document analysis, metadata extraction, action detection
                </div>
                <div>
                  <span className="font-medium">Cost:</span> ~$0.00001875 per 1k input tokens (Flash models)
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6">
            <Button onClick={onBack} variant="outline">
              <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
              {t('back')}
            </Button>

            <Button
              onClick={handleNext}
              disabled={testResult !== 'success'}
            >
              {t('next')}
              <FontAwesomeIcon icon={faArrowRight} className="ml-2" />
            </Button>
          </div>
        </div>

        {/* Right Column: Video & Description */}
        <div className="space-y-4">
          <div className="rounded-lg bg-gray-100 aspect-video flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Video Tutorial</p>
          </div>
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">Creating a Gemini API key:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Go to Google AI Studio (ai.google.dev)</li>
              <li>Sign in with your Google account</li>
              <li>Click "Get API Key"</li>
              <li>Create a new API key</li>
              <li>Copy and paste it here</li>
            </ol>
            <p className="mt-4 text-xs">
              <strong>Note:</strong> The API key is free to create and comes with generous quotas for testing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
