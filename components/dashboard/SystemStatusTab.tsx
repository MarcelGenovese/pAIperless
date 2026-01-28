"use client"

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle,
  faExclamationCircle,
  faSpinner,
  faSync
} from '@fortawesome/free-solid-svg-icons';

interface ServiceStatus {
  name: string;
  status: 'connected' | 'error' | 'checking' | 'not_configured';
  message?: string;
  lastChecked?: string;
}

export default function SystemStatusTab() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'Paperless-NGX', status: 'checking' },
    { name: 'Gemini AI', status: 'checking' },
    { name: 'Document AI', status: 'checking' },
    { name: 'Google OAuth', status: 'checking' },
    { name: 'FTP Server', status: 'checking' },
    { name: 'Worker', status: 'checking' },
  ]);
  const [refreshing, setRefreshing] = useState(false);

  const checkAllServices = async () => {
    setRefreshing(true);

    try {
      const response = await fetch('/api/services/status');
      const data = await response.json();

      setServices([
        {
          name: 'Paperless-NGX',
          status: data.paperless?.status || 'error',
          message: data.paperless?.message,
          lastChecked: new Date().toLocaleTimeString('de-DE'),
        },
        {
          name: 'Gemini AI',
          status: data.gemini?.status || 'error',
          message: data.gemini?.message,
          lastChecked: new Date().toLocaleTimeString('de-DE'),
        },
        {
          name: 'Document AI',
          status: data.documentAI?.status || 'error',
          message: data.documentAI?.message,
          lastChecked: new Date().toLocaleTimeString('de-DE'),
        },
        {
          name: 'Google OAuth',
          status: data.oauth?.status || 'error',
          message: data.oauth?.message,
          lastChecked: new Date().toLocaleTimeString('de-DE'),
        },
        {
          name: 'FTP Server',
          status: data.ftp?.status || 'not_configured',
          message: data.ftp?.message,
          lastChecked: new Date().toLocaleTimeString('de-DE'),
        },
        {
          name: 'Worker',
          status: data.worker?.status || 'error',
          message: data.worker?.message,
          lastChecked: new Date().toLocaleTimeString('de-DE'),
        },
      ]);
    } catch (error) {
      console.error('Failed to check services:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    checkAllServices();
    // Auto-refresh every 30 seconds
    const interval = setInterval(checkAllServices, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />;
      case 'error':
        return <FontAwesomeIcon icon={faExclamationCircle} className="text-red-600" />;
      case 'checking':
        return <FontAwesomeIcon icon={faSpinner} spin className="text-blue-600" />;
      case 'not_configured':
        return <FontAwesomeIcon icon={faExclamationCircle} className="text-gray-400" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Verbunden';
      case 'error':
        return 'Fehler';
      case 'checking':
        return 'Prüfe...';
      case 'not_configured':
        return 'Nicht konfiguriert';
      default:
        return 'Unbekannt';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Service Status</h2>
          <p className="text-sm text-muted-foreground">
            Echtzeit-Status aller Dienste
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={checkAllServices}
          disabled={refreshing}
        >
          <FontAwesomeIcon
            icon={faSync}
            className={`mr-2 ${refreshing ? 'animate-spin' : ''}`}
          />
          Aktualisieren
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dienste</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {services.map((service) => (
              <div
                key={service.name}
                className="flex items-start justify-between py-3 border-b last:border-b-0"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(service.status)}
                    <div>
                      <h3 className="font-semibold">{service.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {service.message || getStatusText(service.status)}
                      </p>
                      {service.lastChecked && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Zuletzt geprüft: {service.lastChecked}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Informationen</CardTitle>
        </CardHeader>
        <CardContent>
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
                {process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
