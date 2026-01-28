"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEnvelope,
  faCode,
  faRocket,
  faHeart,
  faArrowLeft
} from '@fortawesome/free-solid-svg-icons';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AboutPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b sticky top-0 z-10">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
            >
              <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
              Zurück
            </Button>
            <Image
              src="/logo_complete.png"
              alt="pAIperless"
              width={200}
              height={50}
              className="h-10 w-auto"
              priority
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="space-y-8">
            {/* Hero Section */}
            <div className="text-center mb-12">
              <Image
                src="/mg.svg"
                alt="Marcel Genovese"
                width={100}
                height={60}
                className="h-16 w-auto mx-auto mb-6 opacity-80"
              />
              <h1 className="text-4xl font-bold mb-4">Über pAIperless</h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                AI-powered document management für Paperless-NGX
              </p>
            </div>

            {/* About Project */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faRocket} className="text-primary" />
                  Das Projekt
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  pAIperless erweitert Paperless-NGX mit leistungsstarken KI-Funktionen.
                  Automatische OCR durch Google Document AI, intelligentes Tagging und
                  Metadaten-Extraktion durch Gemini LLM, sowie automatische
                  Task-Verwaltung für handlungsrelevante Dokumente.
                </p>
                <div className="grid md:grid-cols-3 gap-4 pt-4">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <div className="text-3xl mb-2">📄</div>
                    <h3 className="font-semibold mb-1">Document AI</h3>
                    <p className="text-sm text-muted-foreground">
                      Hochwertige OCR-Verarbeitung
                    </p>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div className="text-3xl mb-2">🤖</div>
                    <h3 className="font-semibold mb-1">Gemini AI</h3>
                    <p className="text-sm text-muted-foreground">
                      Intelligentes Tagging
                    </p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                    <div className="text-3xl mb-2">⚡</div>
                    <h3 className="font-semibold mb-1">Automatisierung</h3>
                    <p className="text-sm text-muted-foreground">
                      Task-Management
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Author */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faCode} className="text-primary" />
                  Entwickler
                </CardTitle>
                <CardDescription>
                  Erstellt mit <FontAwesomeIcon icon={faHeart} className="text-red-500 mx-1" /> von
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <Image
                    src="/mg.svg"
                    alt="Marcel Genovese"
                    width={80}
                    height={48}
                    className="h-12 w-auto opacity-80"
                  />
                  <div>
                    <h3 className="text-2xl font-bold">Marcel Genovese</h3>
                    <p className="text-muted-foreground">Software Developer</p>
                  </div>
                </div>

                {/* Contact */}
                <div className="pt-4 border-t space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                    Kontakt
                  </h4>
                  <a
                    href="mailto:paiperless@mgenovese.de"
                    className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  >
                    <FontAwesomeIcon icon={faEnvelope} className="text-primary" />
                    <div>
                      <p className="font-medium">E-Mail</p>
                      <p className="text-sm text-muted-foreground">paiperless@mgenovese.de</p>
                    </div>
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Tech Stack */}
            <Card>
              <CardHeader>
                <CardTitle>Technologie-Stack</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    'Next.js 15',
                    'TypeScript',
                    'Prisma',
                    'Tailwind CSS',
                    'Google Document AI',
                    'Google Gemini',
                    'Paperless-NGX',
                    'NextAuth.js'
                  ].map((tech) => (
                    <div
                      key={tech}
                      className="text-center p-3 border rounded-lg hover:border-primary transition-colors"
                    >
                      <p className="text-sm font-medium">{tech}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Version Info */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div>
                    <p>Version 1.0.0</p>
                    <p>© {new Date().getFullYear()} Marcel Genovese</p>
                  </div>
                  <div className="text-right">
                    <p>Erstellt mit Claude Code</p>
                    <p>Next.js 15 + TypeScript</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
