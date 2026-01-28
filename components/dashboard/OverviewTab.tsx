"use client"

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileAlt,
  faExclamationCircle,
  faChartLine,
  faCheckCircle,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';

export default function OverviewTab() {
  const [stats, setStats] = useState({
    totalDocuments: 0,
    pendingActions: 0,
    apiCalls: 0,
    processingStatus: 'idle' as 'idle' | 'processing' | 'error',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch statistics from database
    fetch('/api/dashboard/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load stats:', err);
        setLoading(false);
      });
  }, []);

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
            <FontAwesomeIcon icon={faFileAlt} className="text-accent" />
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
            <FontAwesomeIcon icon={faChartLine} className="text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.apiCalls}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Document AI + Gemini Calls
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium">Worker Status</span>
              <div className="flex items-center gap-2">
                <FontAwesomeIcon
                  icon={stats.processingStatus === 'processing' ? faSpinner : faCheckCircle}
                  className={stats.processingStatus === 'processing' ? 'text-blue-600 animate-spin' : 'text-green-600'}
                  spin={stats.processingStatus === 'processing'}
                />
                <span className="text-sm text-muted-foreground">
                  {stats.processingStatus === 'processing' ? 'Verarbeitet...' : 'Bereit'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Schnellstart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-3xl mb-2">📁</div>
              <h3 className="font-semibold mb-1">Dateien ablegen</h3>
              <p className="text-sm text-muted-foreground">
                PDFs in /consume Ordner legen
              </p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-3xl mb-2">⚡</div>
              <h3 className="font-semibold mb-1">Auto-Verarbeitung</h3>
              <p className="text-sm text-muted-foreground">
                OCR, Tagging und Analyse automatisch
              </p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-3xl mb-2">📊</div>
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
