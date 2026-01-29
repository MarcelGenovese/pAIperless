"use client"

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTerminal, faTrash, faPause, faPlay, faDownload, faBroom } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface LogEntry {
  timestamp: string;
  level: string;
  source: string;
  message: string;
}

export default function LogsTab() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [filters, setFilters] = useState({
    upload: true,
    ftp: true,
    email: true,
    system: true,
    worker: true,
    middleware: true,
    framework: true,
    paperless: true,
    oauth: true,
  });
  const logsEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const fetchDockerLogs = async () => {
    if (paused) {
      console.log('[Logs] Paused, skipping fetch');
      return;
    }

    console.log('[Logs] Fetching docker logs...');

    try {
      const response = await fetch('/api/logs/docker-text?lines=500');
      console.log('[Logs] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Logs] Error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const text = await response.text();
      console.log('[Logs] Received', text.length, 'characters');

      const lines = text.split('\n').filter(line => line.trim());
      console.log('[Logs] Parsed', lines.length, 'lines');

      const parsedLogs: LogEntry[] = lines.map(line => {
        const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(.*)$/);
        if (timestampMatch) {
          const timestamp = timestampMatch[1];
          const message = timestampMatch[2];

          return {
            timestamp,
            level: detectLogLevel(message),
            source: extractSource(message),
            message: message.trim(),
          };
        }

        return {
          timestamp: new Date().toISOString(),
          level: 'INFO',
          source: 'docker',
          message: line.trim(),
        };
      });

      console.log('[Logs] Setting', parsedLogs.length, 'log entries');
      setLogs(parsedLogs);
    } catch (error) {
      console.error('[Logs] Failed to fetch docker logs:', error);
    }
  };

  const detectLogLevel = (message: string): string => {
    const upperMessage = message.toUpperCase();
    if (upperMessage.includes('[ERROR]') || upperMessage.includes('ERROR:')) return 'ERROR';
    if (upperMessage.includes('[WARN]') || upperMessage.includes('WARNING:')) return 'WARN';
    if (upperMessage.includes('[DEBUG]') || upperMessage.includes('DEBUG:')) return 'DEBUG';
    return 'INFO';
  };

  const extractSource = (message: string): string => {
    if (message.includes('[Upload]')) return 'upload';
    if (message.includes('[FTP]')) return 'ftp';
    if (message.includes('[Email]') || message.includes('[SMTP]')) return 'email';
    if (message.includes('[Worker]')) return 'worker';
    if (message.includes('[Middleware]')) return 'middleware';
    if (message.includes('[Paperless]')) return 'paperless';
    if (message.includes('[OAuth]')) return 'oauth';
    if (message.includes('TypeError') || message.includes('Error')) return 'framework';
    if (message.includes('Next.js')) return 'next.js';
    return 'system';
  };

  useEffect(() => {
    // Initial fetch
    fetchDockerLogs();

    // Poll every 2 seconds if not paused
    const intervalId = setInterval(fetchDockerLogs, 2000);

    return () => {
      clearInterval(intervalId);
    };
  }, [paused]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const clearLogs = () => {
    setLogs([]);
  };

  const cleanupOldLogs = async () => {
    setCleaningUp(true);
    try {
      const response = await fetch('/api/logs/cleanup', {
        method: 'DELETE',
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: 'Alte Logs bereinigt',
          description: `${result.database} Datenbankeinträge und ${result.filesystem} Dateien gelöscht`,
        });
      } else {
        throw new Error(result.error || 'Cleanup fehlgeschlagen');
      }
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: error.message || 'Cleanup fehlgeschlagen',
        variant: 'destructive',
      });
    } finally {
      setCleaningUp(false);
    }
  };

  const downloadLogs = () => {
    const logText = logs
      .map((log) => `[${log.timestamp}] [${log.level}] [${log.source}] ${log.message}`)
      .join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paiperless-logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLogLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR':
        return 'text-red-600';
      case 'WARN':
        return 'text-yellow-600';
      case 'INFO':
        return 'text-blue-600';
      case 'DEBUG':
        return 'text-gray-600';
      default:
        return 'text-gray-800';
    }
  };

  const getSourceColor = (source: string) => {
    switch (source.toLowerCase()) {
      case 'upload':
        return 'bg-indigo-100 text-indigo-700';
      case 'ftp':
        return 'bg-purple-100 text-purple-700';
      case 'email':
        return 'bg-green-100 text-green-700';
      case 'worker':
        return 'bg-orange-100 text-orange-700';
      case 'middleware':
        return 'bg-cyan-100 text-cyan-700';
      case 'paperless':
        return 'bg-teal-100 text-teal-700';
      case 'oauth':
        return 'bg-pink-100 text-pink-700';
      case 'framework':
        return 'bg-red-100 text-red-700';
      case 'next.js':
        return 'bg-gray-100 text-gray-700';
      case 'system':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredLogs = logs.filter((log) => {
    const source = log.source.toLowerCase();
    if (source.includes('upload') && !filters.upload) return false;
    if (source.includes('ftp') && !filters.ftp) return false;
    if (source.includes('email') && !filters.email) return false;
    if (source.includes('worker') && !filters.worker) return false;
    if (source.includes('middleware') && !filters.middleware) return false;
    if (source.includes('paperless') && !filters.paperless) return false;
    if (source.includes('oauth') && !filters.oauth) return false;
    if (source.includes('framework') && !filters.framework) return false;
    if (source.includes('system') && !filters.system) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FontAwesomeIcon icon={faTerminal} />
            Live Logs
          </CardTitle>
          <CardDescription>
            Echtzeit-Logs direkt aus dem Docker Container. Zeigt alle Logs inklusive Framework-Fehler, System-Meldungen und Anwendungs-Logs.
            Datenbank-Logs werden automatisch nach 4 Wochen gelöscht.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            {/* Pause/Resume */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaused(!paused)}
            >
              <FontAwesomeIcon icon={paused ? faPlay : faPause} className="mr-2" />
              {paused ? 'Resume' : 'Pause'}
            </Button>

            {/* Clear */}
            <Button
              variant="outline"
              size="sm"
              onClick={clearLogs}
              disabled={logs.length === 0}
            >
              <FontAwesomeIcon icon={faTrash} className="mr-2" />
              Clear
            </Button>

            {/* Download */}
            <Button
              variant="outline"
              size="sm"
              onClick={downloadLogs}
              disabled={logs.length === 0}
            >
              <FontAwesomeIcon icon={faDownload} className="mr-2" />
              Download
            </Button>

            {/* Cleanup Old Logs */}
            <Button
              variant="outline"
              size="sm"
              onClick={cleanupOldLogs}
              disabled={cleaningUp}
            >
              <FontAwesomeIcon icon={faBroom} className="mr-2" />
              {cleaningUp ? 'Bereinige...' : 'Alte Logs löschen (>4 Wochen)'}
            </Button>

            {/* Auto-scroll */}
            <div className="flex items-center gap-2 ml-auto">
              <Switch
                id="auto-scroll"
                checked={autoScroll}
                onCheckedChange={setAutoScroll}
              />
              <Label htmlFor="auto-scroll" className="cursor-pointer">
                Auto-scroll
              </Label>
            </div>

            {/* Log count */}
            <span className="text-sm text-muted-foreground">
              {filteredLogs.length} / {logs.length} Einträge
            </span>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
            <Label className="text-sm font-semibold">Filter:</Label>
            {Object.entries(filters).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <Switch
                  id={`filter-${key}`}
                  checked={value}
                  onCheckedChange={(checked) =>
                    setFilters({ ...filters, [key]: checked })
                  }
                />
                <Label
                  htmlFor={`filter-${key}`}
                  className="cursor-pointer capitalize"
                >
                  {key}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Log Output */}
      <Card>
        <CardContent className="p-0">
          <div
            className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-xs h-[600px] overflow-y-auto p-4 space-y-1 border-t"
            style={{ fontFamily: 'ui-monospace, monospace' }}
          >
            {filteredLogs.length === 0 ? (
              <div className="text-gray-500 text-center py-20">
                {paused ? 'Logs pausiert' : 'Warte auf Logs...'}
              </div>
            ) : (
              filteredLogs.map((log, index) => (
                <div key={index} className="flex gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 rounded">
                  <span className="text-gray-500 shrink-0">{log.timestamp}</span>
                  <span className={cn('font-semibold shrink-0 w-16', getLogLevelColor(log.level))}>
                    [{log.level}]
                  </span>
                  <span className={cn('px-2 py-0.5 rounded text-xs shrink-0', getSourceColor(log.source))}>
                    {log.source}
                  </span>
                  <span className="text-gray-800 dark:text-gray-300">{log.message}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
