"use client"

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRight, Globe } from 'lucide-react';

interface WelcomeScreenProps {
  onNext: (data: Record<string, any>) => void;
}

export default function WelcomeScreen({ onNext }: WelcomeScreenProps) {
  const t = useTranslations('setup');
  const [locale, setLocale] = useState('en');
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    // Auto-detect current URL
    if (typeof window !== 'undefined') {
      const detectedUrl = `${window.location.protocol}//${window.location.host}`;
      setBaseUrl(detectedUrl);
    }
  }, []);

  const handleContinue = async () => {
    // Save locale and base URL
    try {
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 0,
          data: { locale, baseUrl }
        })
      });

      onNext({ locale, baseUrl });
    } catch (error) {
      console.error('Failed to save initial setup:', error);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-primary mb-4">
          {t('welcome')}
        </h1>
        <p className="text-lg text-muted-foreground">
          {t('welcomeDescription')}
        </p>
      </div>

      {/* Video Placeholder - Will show tutorial video in future */}
      <div className="mb-8 rounded-lg bg-gray-100 aspect-video flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Globe className="w-16 h-16 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Welcome Video Coming Soon</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Language Selector */}
        <div className="space-y-2">
          <Label htmlFor="language" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            {t('selectLanguage')}
          </Label>
          <Select value={locale} onValueChange={setLocale}>
            <SelectTrigger id="language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="de">Deutsch</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            More languages coming soon
          </p>
        </div>

        {/* Base URL */}
        <div className="space-y-2">
          <Label htmlFor="baseUrl">
            {t('baseUrl')}
          </Label>
          <Input
            id="baseUrl"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://your-domain.com:3002"
          />
          <p className="text-sm text-muted-foreground">
            {t('baseUrlHelp')}
          </p>
        </div>

        {/* Get Started Button */}
        <Button
          onClick={handleContinue}
          className="w-full"
          size="lg"
          disabled={!baseUrl}
        >
          {t('getStarted')}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>

      {/* Features List */}
      <div className="mt-12 grid md:grid-cols-3 gap-6">
        <div className="text-center">
          <div className="text-3xl mb-2">🤖</div>
          <h3 className="font-semibold mb-1">AI-Powered OCR</h3>
          <p className="text-sm text-muted-foreground">
            Google Document AI for high-quality text extraction
          </p>
        </div>
        <div className="text-center">
          <div className="text-3xl mb-2">🏷️</div>
          <h3 className="font-semibold mb-1">Smart Tagging</h3>
          <p className="text-sm text-muted-foreground">
            Gemini LLM analyzes and extracts metadata automatically
          </p>
        </div>
        <div className="text-center">
          <div className="text-3xl mb-2">📅</div>
          <h3 className="font-semibold mb-1">Action Tracking</h3>
          <p className="text-sm text-muted-foreground">
            Sync with Google Calendar and Tasks for reminders
          </p>
        </div>
      </div>
    </div>
  );
}
