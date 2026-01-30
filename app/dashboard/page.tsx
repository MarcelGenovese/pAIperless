"use client"

import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt, faBars, faTimes } from '@fortawesome/free-solid-svg-icons';

import Sidebar from '@/components/dashboard/Sidebar';
import OverviewTab from '@/components/dashboard/OverviewTab';
import DocumentsTab from '@/components/dashboard/DocumentsTab';
import LogsTab from '@/components/dashboard/LogsTab';
import AnalyzeTab from '@/components/dashboard/AnalyzeTab';
import PaperlessSettingsTab from '@/components/dashboard/PaperlessSettingsTab';
import GoogleSettingsTab from '@/components/dashboard/GoogleSettingsTab';
import FTPSettingsCard from '@/components/dashboard/FTPSettingsCard';
import EmailSettingsCard from '@/components/dashboard/EmailSettingsCard';
import AdvancedSettingsTab from '@/components/dashboard/AdvancedSettingsTab';
import SystemCheckModal from '@/components/dashboard/SystemCheckModal';
import WebhookApiKeyDisplay from '@/components/dashboard/WebhookApiKeyDisplay';
import WebhookValidationWarning from '@/components/dashboard/WebhookValidationWarning';
import Footer from '@/components/Footer';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState('overview');
  const [settingsData, setSettingsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [systemCheckOpen, setSystemCheckOpen] = useState(false);

  useEffect(() => {
    // Load all config data for settings tabs
    const loadSettings = async () => {
      try {
        const responses = await Promise.all([
          fetch('/api/setup/load-config?step=1').then(r => r.json()),
          fetch('/api/setup/load-config?step=2').then(r => r.json()),
          fetch('/api/setup/load-config?step=3').then(r => r.json()),
          fetch('/api/setup/load-config?step=4').then(r => r.json()),
          fetch('/api/setup/load-config?step=5').then(r => r.json()),
          fetch('/api/setup/load-config?step=6').then(r => r.json()),
          fetch('/api/setup/load-config?step=7').then(r => r.json()),
          fetch('/api/setup/load-config?step=8').then(r => r.json()),
        ]);

        const [step1, step2, step3, step4, step5, step6, step7, step8] = responses;

        // Map API response keys to component prop names
        // Note: Be careful with field name collisions - each component uses specific field names
        const mappedData = {
          ...step1,  // Paperless: paperlessUrl, paperlessToken
          ...step2,  // Gemini: geminiApiKey, geminiModel
          ...step3,  // Document AI: projectId, credentials, processorId, location, maxPages, maxSizeMB, enabled
          ...step4,  // Google OAuth: clientId, clientSecret, calendarId, taskListId
          ...step5,  // Email: emailEnabled, smtpServer, smtpPort, smtpEncryption, smtpUser, smtpPassword, emailSender, emailRecipients
          ...step6,  // Paperless Integration: tagAiTodo, tagActionRequired, fieldActionDescription, fieldDueDate
          ...step7,  // Advanced: pollConsumeEnabled, pollConsumeInterval, pollActionEnabled, pollActionInterval, pollAiTodoEnabled, pollAiTodoInterval
          ...step8,  // FTP: ftpEnabled, ftpUsername, ftpPassword, ftpPort, ftpEnableTls, ftpPasvUrl
        };

        setSettingsData(mappedData);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load settings:', error);
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const restartServices = async (service: 'ftp' | 'worker' | 'all' = 'all') => {
    try {
      const response = await fetch('/api/services/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service }),
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Failed to restart services:', error);
      throw error;
    }
  };

  const renderTabContent = () => {
    if (loading && ['paperless', 'google', 'ftp', 'email', 'advanced'].includes(activeTab)) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lade Einstellungen...</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'documents':
        return <DocumentsTab />;
      case 'logs':
        return <LogsTab />;
      case 'analyze':
        return <AnalyzeTab />;
      case 'paperless':
        return <PaperlessSettingsTab initialData={settingsData} />;
      case 'google':
        return <GoogleSettingsTab initialData={settingsData} />;
      case 'ftp':
        return <FTPSettingsCard initialData={{ ...settingsData, enabled: (settingsData as any).ftpEnabled }} onServiceRestart={restartServices} />;
      case 'email':
        return <EmailSettingsCard initialData={{ ...settingsData, enabled: (settingsData as any).emailEnabled }} />;
      case 'advanced':
        return <AdvancedSettingsTab />;
      default:
        return <OverviewTab />;
    }
  };

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-950 flex flex-col overflow-hidden">
      {/* Header - Fixed */}
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b z-10 shrink-0">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <FontAwesomeIcon icon={sidebarOpen ? faTimes : faBars} />
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

            {/* Webhook Validation Warning */}
            <div className="flex-1 flex justify-center items-center gap-3">
              <WebhookValidationWarning />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">
                {session?.user?.name || 'User'}
              </span>
              <div className="hidden md:block">
                <WebhookApiKeyDisplay />
              </div>
              <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: '/auth/login' })}>
                <FontAwesomeIcon icon={faSignOutAlt} className="mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout - Takes remaining height */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:block w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-y-auto shrink-0">
          <Sidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onSystemCheckOpen={() => setSystemCheckOpen(true)}
          />
        </aside>

        {/* Sidebar - Mobile (Overlay) */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setSidebarOpen(false)}>
            <aside
              className="w-64 h-full bg-white dark:bg-gray-900 shadow-xl overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b flex items-center justify-between">
                <span className="font-semibold">Navigation</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(false)}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </Button>
              </div>
              <Sidebar
                activeTab={activeTab}
                onTabChange={(tab) => {
                  setActiveTab(tab);
                  setSidebarOpen(false);
                }}
                onSystemCheckOpen={() => {
                  setSystemCheckOpen(true);
                  setSidebarOpen(false);
                }}
              />
            </aside>
          </div>
        )}

        {/* Main Content - Scrollable area */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 w-full">
            {renderTabContent()}
          </div>
        </main>
      </div>

      {/* Fixed Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:left-64">
        <Footer />
      </div>

      {/* System Check Modal */}
      <SystemCheckModal
        isOpen={systemCheckOpen}
        onClose={() => setSystemCheckOpen(false)}
      />
    </div>
  );
}
