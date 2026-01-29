"use client"

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFolder,
  faSpinner,
  faClock,
  faExclamationTriangle,
  faSync,
  faTrash,
  faFileAlt
} from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';

interface FileInfo {
  name: string;
  size: number;
  createdAt: string;
  path: string;
}

interface FolderContents {
  consume: FileInfo[];
  processing: FileInfo[];
  error: FileInfo[];
}

export default function FolderContents() {
  const [folders, setFolders] = useState<FolderContents>({
    consume: [],
    processing: [],
    error: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState<'consume' | 'processing' | 'error' | null>(null);
  const [clearing, setClearing] = useState(false);

  const loadFolders = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/documents/folders');
      const data = await response.json();

      if (data && !data.error) {
        setFolders(data);
      } else if (data?.error) {
        console.error('[FolderContents] Failed to load folders:', data.error);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to load folders:', error);
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFolders();
    // Auto-refresh every 5 seconds
    const interval = setInterval(loadFolders, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const deleteErrorFile = async (filename: string) => {
    if (!confirm(`Datei "${filename}" wirklich löschen?`)) {
      return;
    }

    try {
      const response = await fetch('/api/documents/delete-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });

      if (response.ok) {
        loadFolders();
      } else {
        const data = await response.json();
        alert('Fehler beim Löschen: ' + (data.error || 'Unbekannter Fehler'));
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
      alert('Fehler beim Löschen der Datei');
    }
  };

  const clearFolder = async (folder: 'consume' | 'processing' | 'error') => {
    setClearing(true);
    try {
      const response = await fetch('/api/documents/clear-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder }),
      });

      if (response.ok) {
        setShowClearConfirm(null);
        loadFolders();
      } else {
        const data = await response.json();
        alert('Fehler beim Leeren: ' + (data.error || 'Unbekannter Fehler'));
      }
    } catch (error) {
      console.error('Failed to clear folder:', error);
      alert('Fehler beim Leeren des Ordners');
    } finally {
      setClearing(false);
    }
  };

  const renderFileList = (
    files: FileInfo[],
    emptyMessage: string,
    showDelete: boolean = false
  ) => {
    if (files.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {emptyMessage}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {files.map((file, index) => (
          <div
            key={index}
            className="flex items-start justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <FontAwesomeIcon icon={faFileAlt} className="text-gray-400 mt-1" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                  <span>{formatFileSize(file.size)}</span>
                  <span>•</span>
                  <span>{formatDate(file.createdAt)}</span>
                </div>
              </div>
            </div>
            {showDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteErrorFile(file.name)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <FontAwesomeIcon icon={faTrash} />
              </Button>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Verarbeitungs-Pipeline</h3>
          <p className="text-sm text-muted-foreground">
            Echtzeit-Übersicht der Dokumente in der Verarbeitung
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadFolders}
          disabled={refreshing}
        >
          <FontAwesomeIcon
            icon={faSync}
            className={`mr-2 ${refreshing ? 'animate-spin' : ''}`}
          />
          Aktualisieren
        </Button>
      </div>

      {/* Folder Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Warteschlange (Consume) */}
        <Card className="border-blue-200 dark:border-blue-900">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FontAwesomeIcon icon={faClock} className="text-blue-600" />
                  Warteschlange
                  <span className="ml-auto text-sm font-normal text-muted-foreground">
                    {folders.consume.length}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Neue Dateien, die auf Verarbeitung warten
                </CardDescription>
              </div>
              {folders.consume.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowClearConfirm('consume')}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {renderFileList(
              folders.consume,
              'Keine Dateien in der Warteschlange'
            )}
          </CardContent>
        </Card>

        {/* In Bearbeitung (Processing) */}
        <Card className="border-yellow-200 dark:border-yellow-900">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FontAwesomeIcon icon={faSpinner} className="text-yellow-600" />
                  In Bearbeitung
                  <span className="ml-auto text-sm font-normal text-muted-foreground">
                    {folders.processing.length}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Dateien, die gerade verarbeitet werden
                </CardDescription>
              </div>
              {folders.processing.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowClearConfirm('processing')}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {renderFileList(
              folders.processing,
              'Keine Dateien in Bearbeitung'
            )}
          </CardContent>
        </Card>

        {/* Fehler (Error) */}
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-600" />
                  Fehler
                  <span className="ml-auto text-sm font-normal text-muted-foreground">
                    {folders.error.length}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Fehlerhafte Dateien (Duplikate oder Fehler)
                </CardDescription>
              </div>
              {folders.error.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowClearConfirm('error')}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {renderFileList(
              folders.error,
              'Keine fehlerhaften Dateien',
              true
            )}
          </CardContent>
        </Card>
      </div>

      {/* Clear Folder Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Ordner leeren?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Möchten Sie wirklich alle Dateien im Ordner &quot;{
                showClearConfirm === 'consume' ? 'Warteschlange' :
                showClearConfirm === 'processing' ? 'In Bearbeitung' : 'Fehler'
              }&quot; löschen?
              {showClearConfirm === 'consume' && ' Diese Dateien werden nicht mehr verarbeitet.'}
              {showClearConfirm === 'processing' && ' Die Verarbeitung dieser Dateien wird abgebrochen.'}
              {showClearConfirm === 'error' && ' Diese Dateien werden endgültig gelöscht.'}
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowClearConfirm(null)}
                disabled={clearing}
              >
                Abbrechen
              </Button>
              <Button
                variant="destructive"
                onClick={() => clearFolder(showClearConfirm)}
                disabled={clearing}
              >
                {clearing ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                    Leeren...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faTrash} className="mr-2" />
                    Ordner leeren
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
