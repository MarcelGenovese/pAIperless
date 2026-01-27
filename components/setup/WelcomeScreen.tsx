"use client"

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
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
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGlobe, faArrowRight } from '@fortawesome/free-solid-svg-icons';

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
    <div className="max-w-2xl mx-auto py-12">
      <div className="text-center mb-12">
        <Image
          src="/logo_complete.png"
          alt="pAIperless"
          width={400}
          height={120}
          className="h-24 w-auto mx-auto mb-8"
          priority
        />
        <h1 className="text-4xl font-bold text-primary mb-4">
          Welcome to pAIperless
        </h1>
        <p className="text-lg text-gray-600">
          AI-powered document processing for Paperless-NGX
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
        {/* Language Selector */}
        <div className="space-y-2">
          <Label htmlFor="language" className="flex items-center gap-2 text-base">
            <FontAwesomeIcon icon={faGlobe} className="text-primary" />
            Select Language
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
        </div>

        {/* Base URL */}
        <div className="space-y-2">
          <Label htmlFor="baseUrl" className="text-base">Application URL</Label>
          <Input
            id="baseUrl"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://your-domain.com"
          />
          <p className="text-sm text-gray-500">
            This URL will be used for OAuth callbacks and webhooks.
          </p>
        </div>

        {/* Features Preview */}
        <div className="pt-6 border-t">
          <h3 className="font-semibold text-gray-900 mb-4">What you'll configure:</h3>
          <ul className="space-y-3 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span><strong>Paperless-NGX</strong> connection and API access</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span><strong>Google Gemini AI</strong> for intelligent document tagging</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span><strong>Document AI</strong> for OCR processing</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span><strong>Google Calendar & Tasks</strong> for action reminders</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span><strong>Optional:</strong> Email notifications and FTP server</span>
            </li>
          </ul>
        </div>

        <Button onClick={handleContinue} className="w-full" size="lg">
          Start Setup
          <FontAwesomeIcon icon={faArrowRight} className="ml-2" />
        </Button>
      </div>
    </div>
  );
}
