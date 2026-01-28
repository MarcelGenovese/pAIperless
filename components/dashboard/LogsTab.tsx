"use client"

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTerminal, faTrash, faPause, faPlay, faDownload } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';

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
  const [filters, setFilters] = useState({
    ftp: true,
    email: true,
    system: true,
    worker: true,
  });
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Connect to Server-Sent Events for live logs
    const connectEventSource = () => {
      const eventSource = new EventSource('/api/logs/stream');

      eventSource.onopen = () => {
        console.log('[Logs] EventSource connected');
      };

      eventSource.onmessage = (event) => {
        if (!paused) {
          try {
            const logEntry: LogEntry = JSON.parse(event.data);
            setLogs((prev) => [...prev.slice(-999), logEntry]); // Keep last 1000 logs
          } catch (error) {
            console.error('[Logs] Failed to parse log entry:', error);
          }
        }
      };

      eventSource.onerror = (error) => {
        console.error('[Logs] EventSource error:', error);
        eventSource.close();
        console.log('[Logs] Reconnecting in 5s...');
        setTimeout(connectEventSource, 5000);
      };

      eventSourceRef.current = eventSource;
    };

    connectEventSource();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
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
      case 'ftp':
        return 'bg-purple-100 text-purple-700';
      case 'email':
        return 'bg-green-100 text-green-700';
      case 'worker':
        return 'bg-orange-100 text-orange-700';
      case 'system':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredLogs = logs.filter((log) => {
    const source = log.source.toLowerCase();
    if (source.includes('ftp') && !filters.ftp) return false;
    if (source.includes('email') && !filters.email) return false;
    if (source.includes('worker') && !filters.worker) return false;
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
            Echtzeit-Logs von FTP Server, Email System, Worker und System
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
