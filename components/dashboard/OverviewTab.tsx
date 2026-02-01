"use client"

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
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
  faChartBar,
  faCoins,
  faFileCircleCheck,
  faSync
} from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import QueueCards from './QueueCards';
import { useTranslations } from 'next-intl';


interface ServiceStatus {
  status: 'connected' | 'error' | 'checking' | 'not_configured';
  message?: string;
}

interface MonthlyUsage {
  month: string;
  documentAI: {
    used: number;
    limit: number;
    percentage: number;
  };
  gemini: {
    tokensSent: number;
    tokensReceived: number;
    totalTokens: number;
    limit: number;
    percentage: number;
  };
  estimatedCost: number;
}

export default function OverviewTab() {
  const t = useTranslations('dashboard');

  const { toast } = useToast();
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
  const [usage, setUsage] = useState<MonthlyUsage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch statistics and service status
    const loadData = async () => {
      try {
        const [statsRes, servicesRes, usageRes] = await Promise.all([
          fetch('/api/dashboard/stats'),
          fetch('/api/services/status'),
          fetch('/api/dashboard/usage')
        ]);

        const statsData = await statsRes.json();
        const servicesData = await servicesRes.json();
        const usageData = await usageRes.json();

        setStats(statsData);
        setServices({
          paperless: servicesData.paperless || { status: 'error' },
          gemini: servicesData.gemini || { status: 'error' },
          documentAI: servicesData.documentAI || { status: 'error' },
          oauth: servicesData.oauth || { status: 'error' },
          ftp: servicesData.ftp || { status: 'not_configured' },
          email: servicesData.email || { status: 'not_configured' },
        });
        setUsage(usageData);
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

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-600';
    if (percentage >= 75) return 'bg-yellow-600';
    return 'bg-[#27417A]';
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('de-DE').format(num);
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
      {/* Queue Status Cards */}
      <QueueCards />

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
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={async () => {
                try {
                  const response = await fetch('/api/action-polling/trigger', {
                    method: 'POST',
                  });
                  const data = await response.json();

                  if (data.success) {
                    toast({
                      title: 'Task-Sync abgeschlossen',
                      description: data.message,
                      variant: 'success',
                    });
                    // Refresh stats
                    const statsRes = await fetch('/api/dashboard/stats');
                    const statsData = await statsRes.json();
                    setStats(statsData);
                  } else {
                    toast({
                      title: 'Fehler',
                      description: data.error || 'Unbekannter Fehler',
                      variant: 'destructive',
                    });
                  }
                } catch (error) {
                  toast({
                    title: 'Fehler',
                    description: 'Netzwerkfehler',
                    variant: 'destructive',
                  });
                }
              }}
            >
              <FontAwesomeIcon icon={faSync} className="mr-2" />
              Erledigte Tasks synchronisieren
            </Button>
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

      {/* Monthly Usage */}
      {usage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FontAwesomeIcon icon={faCoins} className="text-[#0066CC]" />
              Monatliche Nutzung ({usage.month})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Gemini AI Token Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faBrain} className="text-[#0066CC]" />
                    <span className="font-medium">Gemini AI Tokens</span>
                  </div>
                  <span className={cn("font-semibold", getUsageColor(usage.gemini.percentage))}>
                    {usage.gemini.percentage}%
                  </span>
                </div>
                <div className="relative">
                  <Progress
                    value={usage.gemini.percentage}
                    className="h-3"
                  />
                  <div
                    className={cn("absolute top-0 left-0 h-3 rounded-full transition-all", getProgressColor(usage.gemini.percentage))}
                    style={{ width: `${Math.min(usage.gemini.percentage, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>
                    {formatNumber(usage.gemini.totalTokens)} / {formatNumber(usage.gemini.limit)} Tokens
                  </span>
                  <span>
                    Gesendet: {formatNumber(usage.gemini.tokensSent)} | Empfangen: {formatNumber(usage.gemini.tokensReceived)}
                  </span>
                </div>
              </div>

              {/* Document AI Page Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faFileCircleCheck} className="text-[#0066CC]" />
                    <span className="font-medium">Document AI Seiten</span>
                  </div>
                  <span className={cn("font-semibold", getUsageColor(usage.documentAI.percentage))}>
                    {usage.documentAI.percentage}%
                  </span>
                </div>
                <div className="relative">
                  <Progress
                    value={usage.documentAI.percentage}
                    className="h-3"
                  />
                  <div
                    className={cn("absolute top-0 left-0 h-3 rounded-full transition-all", getProgressColor(usage.documentAI.percentage))}
                    style={{ width: `${Math.min(usage.documentAI.percentage, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>
                    {formatNumber(usage.documentAI.used)} / {formatNumber(usage.documentAI.limit)} Seiten
                  </span>
                </div>
              </div>

              {/* Estimated Cost */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('geschaetzte_kosten_monat')}</span>
                  <span className="text-lg font-bold text-[#27417A]">
                    ${usage.estimatedCost.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
              <h3 className="font-semibold mb-1">{t('ueberwachen')}</h3>
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
