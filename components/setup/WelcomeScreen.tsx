"use client"

import { useState, useEffect } from 'react';
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
    <div className="w-full max-w-md mx-auto bg-white shadow-lg">
      {/* Header */}
      <div className="text-center border-b px-6 py-4">
        <Image
          src="/logo_complete.png"
          alt="pAIperless"
          width={300}
          height={80}
          className="h-16 w-auto mx-auto mb-3"
          priority
        />
        <h1 className="text-2xl font-bold text-primary mb-2">
          Welcome to pAIperless
        </h1>
        <p className="text-sm text-gray-600">
          AI-powered document processing for Paperless-NGX
        </p>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
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
        <div className="pt-4 border-t">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm">What you'll configure:</h3>
          <ul className="space-y-2 text-xs text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span><strong>Paperless-NGX</strong> connection</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span><strong>Gemini AI</strong> for document tagging</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span><strong>Document AI</strong> for OCR</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span><strong>Calendar & Tasks</strong> integration</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Optional: Email & FTP</span>
            </li>
          </ul>
        </div>

        <Button onClick={handleContinue} className="w-full mt-4">
          Start Setup
          <FontAwesomeIcon icon={faArrowRight} className="ml-2" />
        </Button>
      </div>
    </div>
  );
}
