"use client"

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTerminal, faTrash, faPause, faPlay, faDownload, faBroom, faSearch } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';


interface LogEntry {
  timestamp: string;
  level: string;
  source: string;
  message: string;
}

export default function LogsTab() {
  const t = useTranslations('dashboard');

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchMode, setSearchMode] = useState<'AND' | 'OR'>('OR');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<LogEntry[] | null>(null);
  const [searchTotal, setSearchTotal] = useState(0);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Log type filters
  const [showLevels, setShowLevels] = useState({
    ERROR: true,
    WARN: true,
    INFO: true,
    DEBUG: true,
  });
  const [showSources, setShowSources] = useState({
    upload: true,
    ftp: true,
    email: true,
    worker: true,
    middleware: true,
    paperless: true,
    oauth: true,
    framework: true,
    'next.js': true,
    system: true,
  });

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
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
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
        title: t('fehler'),
        description: error.message || 'Cleanup fehlgeschlagen',
        variant: 'destructive',
      });
    } finally {
      setCleaningUp(false);
    }
  };

  const downloadLogs = () => {
    const logsToDownload = searchResults || logs;
    const logText = logsToDownload
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

  const searchInDatabase = async () => {
    if (!searchText.trim()) {
      // Clear search results
      setSearchResults(null);
      setSearchTotal(0);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(
        `/api/logs/search?q=${encodeURIComponent(searchText)}&mode=${searchMode}&limit=1000`
      );
      const data = await response.json();

      if (response.ok) {
        // Keep live logs running, add search results separately
        setSearchResults(data.logs || []);
        setSearchTotal(data.total || 0);

        toast({
          title: 'Suche abgeschlossen',
          description: `${data.showing} von ${data.total} Logs gefunden (Live Logs weiter aktiv)`,
        });
      } else {
        throw new Error(data.message || 'Search failed');
      }
    } catch (error) {
      console.error('Failed to search logs:', error);
      toast({
        title: t('suche_fehlgeschlagen'),
        description: t('konnte_nicht_in_logs_suchen'),
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchText('');
    setSearchResults(null);
    setSearchTotal(0);
  };

  const getLogLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR':
        return 'text-red-600 dark:text-red-400';
      case 'WARN':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'INFO':
        return 'text-blue-600 dark:text-blue-400';
      case 'DEBUG':
        return 'text-gray-600 dark:text-gray-400';
      default:
        return 'text-gray-800 dark:text-gray-300';
    }
  };

  const getSourceColor = (source: string) => {
    switch (source.toLowerCase()) {
      case 'upload':
        return 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300';
      case 'ftp':
        return 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300';
      case 'email':
        return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300';
      case 'worker':
        return 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300';
      case 'middleware':
        return 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300';
      case 'paperless':
        return 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300';
      case 'oauth':
        return 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300';
      case 'framework':
        return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300';
      case 'next.js':
        return 'bg-gray-100 dark:bg-gray-700/40 text-gray-700 dark:text-gray-300';
      case 'system':
        return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700/40 text-gray-700 dark:text-gray-300';
    }
  };

  // Filter logs based on text search, level, and source
  const filterLogs = (logList: LogEntry[]) => {
    let filtered = logList;

    // Apply level filters
    filtered = filtered.filter(log => showLevels[log.level as keyof typeof showLevels] !== false);

    // Apply source filters
    filtered = filtered.filter(log => showSources[log.source as keyof typeof showSources] !== false);

    // Apply text search filter (searches in message, source, and level)
    if (searchText.trim()) {
      const searchTerms = searchText.toLowerCase().split(/\s+/);
      filtered = filtered.filter(log => {
        const searchableText = `${log.message} ${log.source} ${log.level}`.toLowerCase();

        if (searchMode === 'AND') {
          return searchTerms.every(term => searchableText.includes(term));
        } else {
          return searchTerms.some(term => searchableText.includes(term));
        }
      });
    }

    return filtered;
  };

  // Combine search results and live logs, then filter
  let combinedLogs: LogEntry[] = [];

  if (searchResults !== null && searchResults.length > 0) {
    // Show search results first (older logs), then live logs
    combinedLogs = [...searchResults, ...logs];

    // Remove duplicates based on timestamp + message
    const seen = new Set<string>();
    combinedLogs = combinedLogs.filter(log => {
      const key = `${log.timestamp}:${log.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } else {
    combinedLogs = logs;
  }

  // Apply all filters
  const displayLogs = filterLogs(combinedLogs);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FontAwesomeIcon icon={faTerminal} />
            Live Logs
          </CardTitle>
          <CardDescription>{t('live_logs_aus_dem_docker_container_datenbank_suche')}</CardDescription>
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
              {searchResults !== null
                ? `${displayLogs.length} angezeigt (${logs.length} Live + ${searchResults.length} DB)`
                : `${displayLogs.length} von ${logs.length} Live Einträgen`}
            </span>
          </div>

          {/* Log Level Filters */}
          <div className="mt-4 pt-4 border-t dark:border-[hsl(0,0%,20%)]">
            <Label className="text-sm font-semibold mb-2 block">
              Log Levels anzeigen
            </Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={showLevels.ERROR ? "default" : "outline"}
                size="sm"
                onClick={() => setShowLevels(prev => ({ ...prev, ERROR: !prev.ERROR }))}
                className={showLevels.ERROR ? "bg-red-600 hover:bg-red-700" : ""}
              >
                ERROR
              </Button>
              <Button
                variant={showLevels.WARN ? "default" : "outline"}
                size="sm"
                onClick={() => setShowLevels(prev => ({ ...prev, WARN: !prev.WARN }))}
                className={showLevels.WARN ? "bg-yellow-600 hover:bg-yellow-700" : ""}
              >
                WARN
              </Button>
              <Button
                variant={showLevels.INFO ? "default" : "outline"}
                size="sm"
                onClick={() => setShowLevels(prev => ({ ...prev, INFO: !prev.INFO }))}
                className={showLevels.INFO ? "bg-blue-600 hover:bg-blue-700" : ""}
              >
                INFO
              </Button>
              <Button
                variant={showLevels.DEBUG ? "default" : "outline"}
                size="sm"
                onClick={() => setShowLevels(prev => ({ ...prev, DEBUG: !prev.DEBUG }))}
                className={showLevels.DEBUG ? "bg-gray-600 hover:bg-gray-700" : ""}
              >
                DEBUG
              </Button>
            </div>
          </div>

          {/* Source Filters */}
          <div className="mt-4 pt-4 border-t dark:border-[hsl(0,0%,20%)]">
            <Label className="text-sm font-semibold mb-2 block">
              Log Sources anzeigen
            </Label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(showSources).map(source => (
                <Button
                  key={source}
                  variant={showSources[source as keyof typeof showSources] ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowSources(prev => ({ ...prev, [source]: !prev[source as keyof typeof showSources] }))}
                  className="text-xs"
                >
                  {source}
                </Button>
              ))}
            </div>
          </div>

          {/* Search Filter */}
          <div className="mt-4 pt-4 border-t dark:border-[hsl(0,0%,20%)]">
            <Label className="text-sm font-semibold mb-2 block">
              <FontAwesomeIcon icon={faSearch} className="mr-2" />
              Text-Suche (Live Logs + Datenbank)
            </Label>
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder={t('suche_nach_text_source_system_middleware_worker_od')}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      searchInDatabase();
                    }
                  }}
                  className="w-full"
                />
              </div>
              <Select value={searchMode} onValueChange={(value: 'AND' | 'OR') => setSearchMode(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OR">ODER</SelectItem>
                  <SelectItem value="AND">UND</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="default"
                size="sm"
                onClick={searchInDatabase}
                disabled={searching || !searchText.trim()}
              >
                <FontAwesomeIcon icon={faSearch} className="mr-2" />
                {searching ? 'Suche...' : 'Suchen'}
              </Button>
              {searchResults !== null && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSearch}
                >
                  <FontAwesomeIcon icon={faTrash} className="mr-2" />{t('zuruecksetzen')}</Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {searchText.trim() ? (
                <>
                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                    🔍 Filtert Live Logs + {searchResults !== null ? `zeigt ${searchResults.length} Datenbank-Ergebnisse` : 'klicke "Suchen" für Datenbank'}
                  </span>
                  <br />
                  {searchMode === 'OR' ? (
                    'Durchsucht Nachricht, Source (system, middleware, worker, ftp, email...) & Level (ERROR, WARN, INFO, DEBUG) - zeigt Einträge mit mindestens einem Suchbegriff'
                  ) : (
                    'Durchsucht Nachricht, Source (system, middleware, worker, ftp, email...) & Level (ERROR, WARN, INFO, DEBUG) - zeigt Einträge mit allen Suchbegriffen'
                  )}
                </>
              ) : (
                'Gib Text ein um Live Logs zu filtern (durchsucht Nachricht + Source + Level). Klicke "Suchen" um auch alte Logs aus der Datenbank zu durchsuchen.'
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Log Output */}
      <Card>
        <CardContent className="p-0">
          <div
            ref={logsContainerRef}
            className="bg-gray-50 dark:bg-[hsl(0,0%,10%)] text-gray-900 dark:text-gray-100 font-mono text-xs h-[600px] overflow-y-auto p-4 space-y-1 border-t dark:border-[hsl(0,0%,20%)]"
            style={{ fontFamily: 'ui-monospace, monospace' }}
          >
            {displayLogs.length === 0 ? (
              <div className="text-gray-500 text-center py-20">
                {searchResults !== null ? 'Keine Suchergebnisse gefunden' : paused ? 'Logs pausiert' : 'Warte auf Logs...'}
              </div>
            ) : (
              displayLogs.map((log, index) => (
                <div key={index} className="flex gap-2 hover:bg-gray-100 dark:hover:bg-[hsl(0,0%,15%)] px-2 py-1 rounded">
                  <span className="text-gray-500 dark:text-gray-400 shrink-0">{log.timestamp}</span>
                  <span className={cn('font-semibold shrink-0 w-16', getLogLevelColor(log.level))}>
                    [{log.level}]
                  </span>
                  <span className={cn('px-2 py-0.5 rounded text-xs shrink-0', getSourceColor(log.source))}>
                    {log.source}
                  </span>
                  <span className="text-gray-800 dark:text-gray-200">{log.message}</span>
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
