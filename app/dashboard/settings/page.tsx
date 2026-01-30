"use client"

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faSignOutAlt,
  faCog,
  faRedo,
  faExclamationTriangle,
  faDatabase,
  faFileAlt
} from '@fortawesome/free-solid-svg-icons';

export default function SettingsPage() {
  const t = useTranslations('settings');

  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [isResettingSetup, setIsResettingSetup] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleResetSetup = async () => {
    setIsResettingSetup(true);
    try {
      // Set SETUP_COMPLETED to false
      const response = await fetch('/api/setup/reset', {
        method: 'POST',
      });

      if (response.ok) {
        toast({
          title: t('setupWizard.resetSuccess'),
          description: t('setupWizard.resetSuccessMessage'),
        });

        // Redirect to setup after a short delay
        setTimeout(() => {
          router.push('/setup');
        }, 1500);
      } else {
        throw new Error('Failed to reset setup');
      }
    } catch (error) {
      toast({
        title: t('status.error'),
        description: t('setupWizard.resetError'),
        variant: "destructive",
      });
      setIsResettingSetup(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Image
                src="/logo_complete.png"
                alt="pAIperless"
                width={180}
                height={50}
                className="h-10 w-auto"
                priority
              />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {session?.user?.name || 'User'}
              </span>
              <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: '/auth/login' })}>
                <FontAwesomeIcon icon={faSignOutAlt} className="mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
              Zurück zum Dashboard
            </Button>
          </Link>
        </div>

        <div className="bg-white shadow-lg p-6">
          <h1 className="text-3xl font-bold text-accent mb-2 flex items-center gap-2">
            <FontAwesomeIcon icon={faCog} />
            Einstellungen
          </h1>
          <p className="text-gray-600 mb-8">
            Verwalten Sie Ihre pAIperless Konfiguration
          </p>

          <div className="space-y-6">
            {/* Setup Section */}
            <div className="border rounded-lg p-6">
              <h2 className="text-xl font-semibold text-accent mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faRedo} />
                Setup Wizard
              </h2>
              <p className="text-gray-600 mb-4">
                Führen Sie den Setup-Wizard erneut aus, um Ihre Konfiguration zu ändern.
              </p>

              {!showResetConfirm ? (
                <Button
                  variant="outline"
                  onClick={() => setShowResetConfirm(true)}
                  disabled={isResettingSetup}
                >
                  <FontAwesomeIcon icon={faRedo} className="mr-2" />
                  Setup erneut ausführen
                </Button>
              ) : (
                <div className="p-4 border border-yellow-500 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                  <div className="flex items-start gap-3 mb-4">
                    <FontAwesomeIcon
                      icon={faExclamationTriangle}
                      className="text-yellow-600 text-xl mt-1"
                    />
                    <div>
                      <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                        Setup zurücksetzen?
                      </h3>
                      <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                        Dies setzt die Setup-Konfiguration zurück und leitet Sie zum Setup-Wizard weiter.
                        <strong className="block mt-1">Ihre vorhandenen Einstellungen bleiben erhalten</strong> und
                        werden im Wizard vorausgefüllt.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleResetSetup}
                          disabled={isResettingSetup}
                          size="sm"
                        >
                          {isResettingSetup ? t('setupWizard.resetting') : t('setupWizard.resetConfirm')}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowResetConfirm(false)}
                          disabled={isResettingSetup}
                          size="sm"
                        >
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* System Info Section */}
            <div className="border rounded-lg p-6">
              <h2 className="text-xl font-semibold text-accent mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faDatabase} />
                System Information
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Version</span>
                  <span className="font-medium">1.0.0</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Database</span>
                  <span className="font-medium">SQLite</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Node.js Runtime</span>
                  <span className="font-medium">Enabled</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Environment</span>
                  <span className="font-medium">
                    {process.env.NODE_ENV === 'production' ? t('systemInfo.production') : t('systemInfo.development')}
                  </span>
                </div>
              </div>
            </div>

            {/* Documentation Section */}
            <div className="border rounded-lg p-6">
              <h2 className="text-xl font-semibold text-accent mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faFileAlt} />
                Dokumentation
              </h2>
              <p className="text-gray-600 mb-4">
                Weitere Informationen zur Konfiguration und Verwendung von pAIperless.
              </p>
              <div className="space-y-2">
                <div className="text-sm">
                  <strong>CLAUDE.md</strong> - Technische Dokumentation und Architektur
                </div>
                <div className="text-sm">
                  <strong>KONZEPT.md</strong> - Feature-Übersicht und Vision
                </div>
                <div className="text-sm">
                  <strong>PLAN.md</strong> - Implementierungsplan und Status
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
