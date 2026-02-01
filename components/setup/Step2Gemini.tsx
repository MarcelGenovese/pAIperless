"use client"

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faArrowRight, faEye, faEyeSlash, faCheckCircle, faTimesCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';

interface Step2GeminiProps {
  onNext: (data: Record<string, any>) => void;
  onBack: () => void;
  data: Record<string, any>;
}

export default function Step2Gemini({ onNext, onBack, data }: Step2GeminiProps) {
  const t = useTranslations('setup');
  const { toast } = useToast();

  const [geminiApiKey, setGeminiApiKey] = useState(data.geminiApiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [geminiModel, setGeminiModel] = useState(data.geminiModel || '');
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

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
        body: JSON.stringify({ apiKey: geminiApiKey }),
      });

      const result = await response.json();
      console.log('Loaded models:', result.models);

      if (response.ok && result.models) {
        setModels(result.models);

        // Auto-select first model (should be gemini-2.0-flash-exp) if none selected
        if (result.models.length > 0 && !geminiModel) {
          const defaultModel = result.models[0].id;
          console.log('Auto-selecting model:', defaultModel);
          setGeminiModel(defaultModel);
        }
      } else {
        toast({
          title: 'Failed to load models',
          description: result.error || 'Could not fetch available models',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to load models:', error);
      toast({
        title: 'Error loading models',
        description: 'An error occurred while fetching models',
        variant: 'destructive',
      });
    } finally {
      setLoadingModels(false);
    }
  };

  const handleTestConnection = async () => {
    console.log('Testing Gemini API with model:', geminiModel);
    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/setup/test-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: geminiApiKey, model: geminiModel }),
      });

      console.log('Gemini response status:', response.status);
      console.log('Gemini response headers:', response.headers.get('content-type'));

      const responseText = await response.text();
      console.log('Gemini raw response body:', responseText);

      let result;
      try {
        result = JSON.parse(responseText);
        console.log('Gemini parsed result:', result);
      } catch (e) {
        console.error('Failed to parse response:', e);
        result = { error: 'Invalid server response: ' + responseText };
      }

      if (response.ok) {
        setTestResult('success');
        toast({
          title: t('test_successful_setup'),
          description: 'Gemini API is working correctly',
        });

        // Save configuration
        await fetch('/api/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            step: 2,
            data: {
              geminiApiKey,
              geminiModel,
            }
          }),
        });
      } else {
        setTestResult('error');
        const errorMsg = result?.error || 'Failed to connect to Gemini API';
        console.error('Gemini test error - showing to user:', errorMsg);

        toast({
          title: t('test_failed_setup'),
          description: errorMsg,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      setTestResult('error');
      console.error('Gemini test exception:', error);
      toast({
        title: t('test_error'),
        description: error.message || 'An error occurred during testing',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleNext = () => {
    onNext({ geminiApiKey, geminiModel });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-accent mb-2">
          Step 2: Google Gemini AI
        </h2>
        <p className="text-gray-600">
          Configure Google Gemini AI for intelligent document tagging and analysis.
        </p>
      </div>

      {/* API Key */}
      <div className="space-y-2">
        <Label htmlFor="geminiApiKey">
          Gemini API Key <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <Input
            id="geminiApiKey"
            type={showApiKey ? 'text' : 'password'}
            placeholder="AIza..."
            value={geminiApiKey}
            onChange={(e) => {
              setGeminiApiKey(e.target.value);
              setTestResult(null);
            }}
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
          >
            <FontAwesomeIcon icon={showApiKey ? faEyeSlash : faEye} />
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Your Google AI Studio API key (aistudio.google.com)
        </p>
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <Label htmlFor="geminiModel">
          Gemini Model <span className="text-red-500">*</span>
        </Label>
        <Select
          value={geminiModel}
          onValueChange={(value) => {
            console.log('Model selected:', value);
            setGeminiModel(value);
            setTestResult(null);
          }}
          disabled={loadingModels || models.length === 0}
        >
          <SelectTrigger id="geminiModel">
            <SelectValue placeholder={loadingModels ? "Loading models..." : "Select a model"} />
          </SelectTrigger>
          <SelectContent>
            {models.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-gray-500">
          {loadingModels ? 'Loading available models...' : models.length > 0 ? `${models.length} models available` : 'Recommended: gemini-2.0-flash-exp'}
        </p>
      </div>

      {/* Test Connection */}
      <div className="flex gap-4">
        <Button
          onClick={handleTestConnection}
          disabled={!geminiApiKey || !geminiModel || testing || loadingModels}
          variant="outline"
          className="flex-1"
        >
          <FontAwesomeIcon icon={testing ? faSpinner : faCheckCircle} className={`mr-2 ${testing ? 'animate-spin' : ''}`} />
          {testing ? 'Testing...' : 'Test API Connection'}
        </Button>
        {testResult === 'success' && (
          <div className="flex items-center gap-2 text-green-600">
            <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />
            <span className="text-sm">Success</span>
          </div>
        )}
        {testResult === 'error' && (
          <div className="flex items-center gap-2 text-red-600">
            <FontAwesomeIcon icon={faTimesCircle} className="text-red-600" />
            <span className="text-sm">Failed</span>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-6">
        <Button onClick={onBack} variant="outline">
          <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
          Back
        </Button>

        <Button
          onClick={handleNext}
          disabled={testResult !== 'success'}
        >
          Next
          <FontAwesomeIcon icon={faArrowRight} className="ml-2" />
        </Button>
      </div>
    </div>
  );
}
