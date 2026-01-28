"use client"

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEnvelope,
  faArrowLeft,
  faHeart,
  faFileAlt,
  faRobot,
  faBolt
} from '@fortawesome/free-solid-svg-icons';
import { faGithub, faPaypal } from '@fortawesome/free-brands-svg-icons';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function AboutPage() {
  const router = useRouter();
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    // Load version from API
    fetch('/api/version')
      .then(res => res.json())
      .then(data => setVersion(data.version || 'unknown'))
      .catch(() => setVersion('unknown'));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b sticky top-0 z-10">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
            >
              <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
              Zurück
            </Button>
            <Image
              src="/logo_small.png"
              alt="pAIperless"
              width={120}
              height={40}
              className="h-8 w-auto"
              priority
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="space-y-6">
            {/* Hero Section */}
            <div className="text-center mb-8">
              <Image
                src="/logo_complete.png"
                alt="pAIperless"
                width={300}
                height={80}
                className="h-20 w-auto mx-auto mb-4"
              />
              <p className="text-lg text-muted-foreground">
                AI-powered document management für Paperless-NGX
              </p>
            </div>

            {/* About */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Über das Projekt</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-muted-foreground leading-relaxed">
                <p>
                  pAIperless erweitert Paperless-NGX mit leistungsstarken KI-Funktionen
                  für die automatische Dokumentenverarbeitung.
                </p>
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded">
                    <FontAwesomeIcon icon={faFileAlt} className="text-2xl mb-1 text-blue-600" />
                    <p className="text-xs font-medium">Document AI OCR</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded">
                    <FontAwesomeIcon icon={faRobot} className="text-2xl mb-1 text-blue-600" />
                    <p className="text-xs font-medium">Gemini Tagging</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded">
                    <FontAwesomeIcon icon={faBolt} className="text-2xl mb-1 text-blue-600" />
                    <p className="text-xs font-medium">Automatisierung</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Author & Contact */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  Entwickler
                  <FontAwesomeIcon icon={faHeart} className="text-[#27417A] text-sm" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Image
                    src="/mg.svg"
                    alt="Marcel Genovese"
                    width={60}
                    height={36}
                    className="h-10 w-auto invert dark:invert-0"
                  />
                  <div>
                    <h3 className="text-xl font-bold">Marcel Genovese</h3>
                    <p className="text-sm text-muted-foreground">Software Developer</p>
                  </div>
                </div>

                {/* Contact Links */}
                <div className="grid grid-cols-1 gap-2 pt-2">
                  <a
                    href="mailto:info@paiperless.de"
                    className="flex items-center gap-3 p-2 rounded border hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors text-sm"
                  >
                    <FontAwesomeIcon icon={faEnvelope} className="text-primary w-5" />
                    <span>info@paiperless.de</span>
                  </a>
                  <a
                    href="https://github.com/MarcelGenovese"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2 rounded border hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors text-sm"
                  >
                    <FontAwesomeIcon icon={faGithub} className="text-primary w-5" />
                    <span>GitHub: MarcelGenovese</span>
                  </a>
                  <a
                    href="https://paypal.me/mg3n0"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2 rounded border hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors text-sm"
                  >
                    <FontAwesomeIcon icon={faPaypal} className="text-primary w-5" />
                    <span>Spenden via PayPal</span>
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Version */}
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-sm text-muted-foreground">
                  <p className="font-mono">Version: {version}</p>
                  <p className="mt-2">© {new Date().getFullYear()} Marcel Genovese</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
