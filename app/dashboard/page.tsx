"use client"

import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt, faHome, faFileAlt, faCog, faServer } from '@fortawesome/free-solid-svg-icons';

import OverviewTab from '@/components/dashboard/OverviewTab';
import DocumentsTab from '@/components/dashboard/DocumentsTab';
import SettingsTab from '@/components/dashboard/SettingsTab';
import SystemStatusTab from '@/components/dashboard/SystemStatusTab';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState('overview');
  const [settingsData, setSettingsData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load all config data for settings tab
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

        setSettingsData({
          ...step1,
          ...step2,
          ...step3,
          ...step4,
          ...step5,
          ...step6,
          ...step7,
          ...step8,
        });
        setLoading(false);
      } catch (error) {
        console.error('Failed to load settings:', error);
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Image
                src="/logo_complete.png"
                alt="pAIperless"
                width={200}
                height={50}
                className="h-12 w-auto"
                priority
              />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto">
            <TabsTrigger value="overview" className="gap-2">
              <FontAwesomeIcon icon={faHome} />
              <span className="hidden sm:inline">Übersicht</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <FontAwesomeIcon icon={faFileAlt} />
              <span className="hidden sm:inline">Dokumente</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <FontAwesomeIcon icon={faCog} />
              <span className="hidden sm:inline">Einstellungen</span>
            </TabsTrigger>
            <TabsTrigger value="status" className="gap-2">
              <FontAwesomeIcon icon={faServer} />
              <span className="hidden sm:inline">System Status</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <OverviewTab />
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <DocumentsTab />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            {loading ? (
              <div className="text-center py-12">Lade Einstellungen...</div>
            ) : (
              <SettingsTab initialData={settingsData} />
            )}
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            <SystemStatusTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
