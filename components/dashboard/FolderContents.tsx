"use client"

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFolder,
  faSpinner,
  faClock,
  faExclamationTriangle,
  faSync,
  faTrash,
  faFileAlt,
  faRotateRight
} from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';


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

interface QueueCounts {
  pending: number;
  processing: number;
  error: number;
  completed: number;
}

interface ErrorDocument {
  id: number;
  originalFilename: string;
  errorMessage: string | null;
  updatedAt: string;
  paperlessId: number | null;
}

export default function FolderContents() {
  const t = useTranslations('dashboard');

  const { toast } = useToast();
  const [folders, setFolders] = useState<FolderContents>({
    consume: [],
    processing: [],
    error: [],
  });
  const [queueCounts, setQueueCounts] = useState<QueueCounts>({
    pending: 0,
    processing: 0,
    error: 0,
    completed: 0,
  });
  const [errorDocuments, setErrorDocuments] = useState<ErrorDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState<'consume' | 'processing' | 'error' | null>(null);
  const [clearing, setClearing] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const loadFolders = async () => {
    setRefreshing(true);
    try {
      // Load both folder contents and queue counts in parallel
      const [foldersResponse, queueResponse] = await Promise.all([
        fetch('/api/documents/folders'),
        fetch('/api/dashboard/queue')
      ]);

      const foldersData = await foldersResponse.json();
      const queueData = await queueResponse.json();

      if (foldersData && !foldersData.error) {
        setFolders(foldersData);
      } else if (foldersData?.error) {
        console.error('[FolderContents] Failed to load folders:', foldersData.error);
      }

      if (queueData && !queueData.error) {
        if (queueData.counts) {
          setQueueCounts(queueData.counts);
        }
        if (queueData.documents?.error) {
          setErrorDocuments(queueData.documents.error);
        }
      } else if (queueData?.error) {
        console.error('[FolderContents] Failed to load queue counts:', queueData.error);
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

  const clearFolder = async (folder: 'consume' | 'processing' | 'error') => {
    setClearing(true);
    try {
      const response = await fetch('/api/documents/clear-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Ordner geleert',
          description: `${data.deleted} Datei(en) erfolgreich gelöscht`,
          variant: 'success',
        });
        setShowClearConfirm(null);
        await loadFolders();
      } else {
        toast({
          title: t('fehler_beim_leeren'),
          description: data.error || 'Unbekannter Fehler',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: t('fehler'),
        description: error.message || 'Fehler beim Leeren des Ordners',
        variant: 'destructive',
      });
    } finally {
      setClearing(false);
    }
  };

  const triggerManualProcessing = async () => {
    setTriggering(true);
    try {
      const response = await fetch('/api/documents/trigger-consume', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: t('verarbeitung_ausgeloest'),
          description: data.message || 'Verarbeitung wurde manuell ausgelöst',
          variant: 'success',
        });
        loadFolders();
      } else {
        const data = await response.json();
        toast({
          title: t('fehler'),
          description: data.error || 'Fehler beim Auslösen',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: t('fehler'),
        description: error.message || 'Fehler beim Auslösen der Verarbeitung',
        variant: 'destructive',
      });
    } finally {
      setTriggering(false);
    }
  };

  const handleRetry = async (documentId: number, errorMessage: string | null) => {
    setRetrying(documentId);
    try {
      // Check if this is a duplicate error
      const isDuplicate = errorMessage?.includes('Duplikat') ||
                        errorMessage?.includes('duplicate') ||
                        errorMessage?.includes('DUPLICATE');

      let response;
      if (isDuplicate) {
        response = await fetch('/api/documents/retry-duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId }),
        });
      } else {
        response = await fetch('/api/documents/retry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId }),
        });
      }

      if (response.ok) {
        toast({
          title: isDuplicate ? 'Duplikat wird erneut verarbeitet' : 'Dokument wird erneut verarbeitet',
          description: isDuplicate ? 'Dokument wurde mit neuem Hash zurück in den Consume-Ordner verschoben' : 'Verarbeitung wurde neu gestartet',
          variant: 'success',
        });
        await loadFolders();
      } else {
        const data = await response.json();
        toast({
          title: t('fehler_beim_wiederholen'),
          description: data.error || 'Unbekannter Fehler',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: t('fehler'),
        description: error.message || 'Dokument konnte nicht erneut verarbeitet werden',
        variant: 'destructive',
      });
    } finally {
      setRetrying(null);
    }
  };

  const handleDelete = async (documentId: number, filename: string) => {
    if (!confirm(`Dokument "${filename}" wirklich löschen?`)) {
      return;
    }

    setDeleting(documentId);
    try {
      const response = await fetch('/api/documents/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });

      if (response.ok) {
        toast({
          title: t('dokument_geloescht'),
          description: `"${filename}" wurde erfolgreich gelöscht`,
          variant: 'success',
        });
        await loadFolders();
      } else {
        const data = await response.json();
        toast({
          title: t('fehler_beim_loeschen'),
          description: data.error || 'Unbekannter Fehler',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: t('fehler'),
        description: error.message || 'Dokument konnte nicht gelöscht werden',
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  };

  const renderFileList = (
    files: FileInfo[],
    emptyMessage: string
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
          </div>
        ))}
      </div>
    );
  };

  const renderErrorList = () => {
    if (errorDocuments.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Keine fehlerhaften Dokumente
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {errorDocuments.map((doc) => (
          <div
            key={doc.id}
            className="flex items-start justify-between p-3 border rounded-lg bg-red-50 dark:bg-[hsl(0,40%,15%)] border-red-200 dark:border-[hsl(0,40%,25%)] transition-colors"
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <FontAwesomeIcon icon={faFileAlt} className="text-red-600 mt-1" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.originalFilename}</p>
                {doc.errorMessage && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 line-clamp-2">
                    {doc.errorMessage}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDate(doc.updatedAt)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRetry(doc.id, doc.errorMessage)}
                disabled={retrying === doc.id}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-[hsl(220,40%,18%)]"
                title="Erneut verarbeiten"
              >
                <FontAwesomeIcon
                  icon={faRotateRight}
                  className={retrying === doc.id ? 'animate-spin' : ''}
                />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(doc.id, doc.originalFilename)}
                disabled={deleting === doc.id}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-[hsl(0,40%,18%)]"
                title={t('loeschen')}
              >
                <FontAwesomeIcon icon={faTrash} />
              </Button>
            </div>
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
                    {folders.consume.length} / {queueCounts.pending} DB
                  </span>
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Neue Dateien, die auf Verarbeitung warten
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={triggerManualProcessing}
                  disabled={triggering}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-[hsl(220,40%,18%)]"
                  title={t('verarbeitung_manuell_ausloesen')}
                >
                  <FontAwesomeIcon icon={faSync} className={triggering ? 'animate-spin' : ''} />
                </Button>
                {folders.consume.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowClearConfirm('consume')}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-[hsl(0,40%,18%)]"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </Button>
                )}
              </div>
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
                    {folders.processing.length} / {queueCounts.processing} DB
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
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-[hsl(0,40%,18%)]"
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
                  <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-600" />{t('fehler')}<span className="ml-auto text-sm font-normal text-muted-foreground">
                    {errorDocuments.length} / {queueCounts.error} DB
                  </span>
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Fehlerhafte Dateien (Duplikate oder Fehler)
                </CardDescription>
              </div>
              {errorDocuments.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowClearConfirm('error')}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-[hsl(0,40%,18%)]"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {renderErrorList()}
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
