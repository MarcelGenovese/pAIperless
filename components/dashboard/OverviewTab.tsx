"use client"

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileAlt,
  faExclamationCircle,
  faChartLine,
  faCheckCircle,
  faSpinner,
  faServer,
  faBrain,
  faGlobe,
  faEnvelope,
  faFolderOpen,
  faBolt,
  faChartBar
} from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';

interface ServiceStatus {
  status: 'connected' | 'error' | 'checking' | 'not_configured';
  message?: string;
}

export default function OverviewTab() {
  const [stats, setStats] = useState({
    totalDocuments: 0,
    pendingActions: 0,
    apiCalls: 0,
    processingStatus: 'idle' as 'idle' | 'processing' | 'error',
  });
  const [services, setServices] = useState<Record<string, ServiceStatus>>({
    paperless: { status: 'checking' },
    gemini: { status: 'checking' },
    documentAI: { status: 'checking' },
    oauth: { status: 'checking' },
    ftp: { status: 'checking' },
    email: { status: 'checking' },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch statistics and service status
    const loadData = async () => {
      try {
        const [statsRes, servicesRes] = await Promise.all([
          fetch('/api/dashboard/stats'),
          fetch('/api/services/status')
        ]);

        const statsData = await statsRes.json();
        const servicesData = await servicesRes.json();

        setStats(statsData);
        setServices({
          paperless: servicesData.paperless || { status: 'error' },
          gemini: servicesData.gemini || { status: 'error' },
          documentAI: servicesData.documentAI || { status: 'error' },
          oauth: servicesData.oauth || { status: 'error' },
          ftp: servicesData.ftp || { status: 'not_configured' },
          email: servicesData.email || { status: 'not_configured' },
        });
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'checking':
        return 'text-blue-600';
      case 'not_configured':
        return 'text-gray-400';
      default:
        return 'text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <FontAwesomeIcon icon={faSpinner} spin className="text-accent text-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Dokumente verarbeitet
            </CardTitle>
            <FontAwesomeIcon icon={faFileAlt} className="text-[#0066CC]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDocuments}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Gesamt verarbeitete Dokumente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ausstehende Aktionen
            </CardTitle>
            <FontAwesomeIcon icon={faExclamationCircle} className="text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingActions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Dokumente mit action_required Tag
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              API Calls (Monat)
            </CardTitle>
            <FontAwesomeIcon icon={faChartLine} className="text-[#0066CC]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.apiCalls}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Document AI + Gemini Calls
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Paperless */}
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <FontAwesomeIcon
                icon={faServer}
                className={cn("text-lg", getStatusColor(services.paperless.status))}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">Paperless-NGX</p>
                <p className="text-xs text-muted-foreground">
                  {services.paperless.status === 'connected' ? 'Verbunden' :
                   services.paperless.status === 'checking' ? 'Prüfe...' :
                   services.paperless.message || 'Nicht konfiguriert'}
                </p>
              </div>
            </div>

            {/* Gemini */}
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <FontAwesomeIcon
                icon={faBrain}
                className={cn("text-lg", getStatusColor(services.gemini.status))}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">Gemini AI</p>
                <p className="text-xs text-muted-foreground">
                  {services.gemini.status === 'connected' ? 'Verbunden' :
                   services.gemini.status === 'checking' ? 'Prüfe...' :
                   services.gemini.message || 'Nicht konfiguriert'}
                </p>
              </div>
            </div>

            {/* Document AI */}
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <FontAwesomeIcon
                icon={faFileAlt}
                className={cn("text-lg", getStatusColor(services.documentAI.status))}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">Document AI</p>
                <p className="text-xs text-muted-foreground">
                  {services.documentAI.status === 'connected' ? 'Verbunden' :
                   services.documentAI.status === 'checking' ? 'Prüfe...' :
                   services.documentAI.message || 'Nicht konfiguriert'}
                </p>
              </div>
            </div>

            {/* Google OAuth */}
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <FontAwesomeIcon
                icon={faGlobe}
                className={cn("text-lg", getStatusColor(services.oauth.status))}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">Google OAuth</p>
                <p className="text-xs text-muted-foreground">
                  {services.oauth.status === 'connected' ? 'Verbunden' :
                   services.oauth.status === 'checking' ? 'Prüfe...' :
                   services.oauth.message || 'Nicht konfiguriert'}
                </p>
              </div>
            </div>

            {/* FTP */}
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <FontAwesomeIcon
                icon={faServer}
                className={cn("text-lg", getStatusColor(services.ftp.status))}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">FTP Server</p>
                <p className="text-xs text-muted-foreground">
                  {services.ftp.status === 'connected' ? 'Läuft' :
                   services.ftp.status === 'checking' ? 'Prüfe...' :
                   services.ftp.message || 'Deaktiviert'}
                </p>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <FontAwesomeIcon
                icon={faEnvelope}
                className={cn("text-lg", getStatusColor(services.email.status))}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">E-Mail</p>
                <p className="text-xs text-muted-foreground">
                  {services.email.status === 'connected' ? 'Konfiguriert' :
                   services.email.status === 'checking' ? 'Prüfe...' :
                   services.email.message || 'Deaktiviert'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Letzte Dokumente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Für eine vollständige Liste verwenden Sie den Dokumente-Tab
          </p>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Schnellstart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-4 border rounded-lg hover:border-[#27417A] transition-colors">
              <FontAwesomeIcon icon={faFolderOpen} className="text-4xl mb-2 text-[#27417A]" />
              <h3 className="font-semibold mb-1">Dateien ablegen</h3>
              <p className="text-sm text-muted-foreground">
                PDFs in /consume Ordner legen
              </p>
            </div>
            <div className="text-center p-4 border rounded-lg hover:border-[#27417A] transition-colors">
              <FontAwesomeIcon icon={faBolt} className="text-4xl mb-2 text-[#27417A]" />
              <h3 className="font-semibold mb-1">Auto-Verarbeitung</h3>
              <p className="text-sm text-muted-foreground">
                OCR, Tagging und Analyse automatisch
              </p>
            </div>
            <div className="text-center p-4 border rounded-lg hover:border-[#27417A] transition-colors">
              <FontAwesomeIcon icon={faChartBar} className="text-4xl mb-2 text-[#27417A]" />
              <h3 className="font-semibold mb-1">Überwachen</h3>
              <p className="text-sm text-muted-foreground">
                Fortschritt im Documents-Tab verfolgen
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
