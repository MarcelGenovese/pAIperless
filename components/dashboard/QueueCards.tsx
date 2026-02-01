"use client"

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClock,
  faSpinner,
  faExclamationTriangle,
  faRotateRight,
  faCheckCircle,
  faSync,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';


interface QueueData {
  counts: {
    pending: number;
    processing: number;
    error: number;
    completed: number;
  };
  documents: {
    pending: Array<{
      id: number;
      originalFilename: string;
      createdAt: string;
      paperlessId: number | null;
    }>;
    processing: Array<{
      id: number;
      originalFilename: string;
      status: string;
      updatedAt: string;
      paperlessId: number | null;
    }>;
    error: Array<{
      id: number;
      originalFilename: string;
      errorMessage: string | null;
      updatedAt: string;
      paperlessId: number | null;
    }>;
  };
}

export default function QueueCards() {
  const t = useTranslations('dashboard');

  const { toast } = useToast();
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchQueueData = async () => {
    try {
      const response = await fetch('/api/dashboard/queue');
      const data = await response.json();
      setQueueData(data);
    } catch (error) {
      console.error('Failed to fetch queue data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueData();

    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchQueueData, 10000);
    return () => clearInterval(interval);
  }, []);

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
        await fetchQueueData();
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
        // Use special duplicate retry endpoint
        response = await fetch('/api/documents/retry-duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId }),
        });
      } else {
        // Regular retry
        response = await fetch('/api/documents/retry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId }),
        });
      }

      if (response.ok) {
        toast({
          title: isDuplicate ? t('duplikat_wird_erneut_verarbeitet') : t('dokument_wird_erneut_verarbeitet'),
          description: isDuplicate
            ? t('dokument_wurde_mit_neuem_hash_zurueck_in_den_consu')
            : t('verarbeitung_wurde_neu_gestartet'),
          variant: 'success',
        });
        // Refresh data
        await fetchQueueData();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Retry failed');
      }
    } catch (error: any) {
      console.error('Failed to retry document:', error);
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
        await fetchQueueData();
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('de-DE', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING: 'Wartend',
      PREPROCESSING: 'Vorverarbeitung',
      OCR_IN_PROGRESS: 'OCR läuft',
      OCR_COMPLETE: 'OCR fertig',
      UPLOADING_TO_PAPERLESS: 'Upload läuft',
    };
    return labels[status] || status;
  };

  if (loading || !queueData) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pending Queue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('queue')}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={triggerManualProcessing}
                disabled={triggering}
                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-[hsl(220,40%,18%)]"
                title={t('verarbeitung_manuell_ausloesen')}
              >
                <FontAwesomeIcon icon={faSync} className={triggering ? 'animate-spin' : ''} />
              </Button>
              <FontAwesomeIcon icon={faClock} className="text-yellow-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueData.counts.pending}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('documents_waiting_for_processing')}
            </p>
          </CardContent>
        </Card>

        {/* Processing */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('in_processing')}
            </CardTitle>
            <FontAwesomeIcon icon={faSpinner} spin className="text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueData.counts.processing}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('documents_being_processed')}
            </p>
          </CardContent>
        </Card>

        {/* Errors */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('fehler')}</CardTitle>
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueData.counts.error}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('error_documents')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Error Documents List */}
      {queueData.documents.error.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-600" />
              {t('error_documents')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {queueData.documents.error.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-red-50 dark:bg-[hsl(0,40%,15%)] border-red-200 dark:border-[hsl(0,40%,25%)]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{doc.originalFilename}</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 truncate">
                      {doc.errorMessage || 'Unbekannter Fehler'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(doc.updatedAt)}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-3 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRetry(doc.id, doc.errorMessage)}
                      disabled={retrying === doc.id || deleting === doc.id}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <FontAwesomeIcon
                        icon={faRotateRight}
                        className={cn("mr-2", retrying === doc.id && "animate-spin")}
                      />
                      Retry
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(doc.id, doc.originalFilename)}
                      disabled={retrying === doc.id || deleting === doc.id}
                      className="text-red-600 hover:text-red-700"
                    >
                      <FontAwesomeIcon icon={faTrash} className="mr-2" />
                      Löschen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Documents List */}
      {queueData.documents.pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FontAwesomeIcon icon={faClock} className="text-yellow-600" />
              {t('pending_documents')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {queueData.documents.pending.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{doc.originalFilename}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(doc.createdAt)}
                    </p>
                  </div>
                  <FontAwesomeIcon icon={faClock} className="text-yellow-600 ml-3" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing Documents List */}
      {queueData.documents.processing.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FontAwesomeIcon icon={faSpinner} spin className="text-blue-600" />
              {t('documents_in_processing')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {queueData.documents.processing.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 border border-blue-200 dark:border-[hsl(210,40%,25%)] rounded-lg bg-blue-50 dark:bg-[hsl(210,40%,15%)]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{doc.originalFilename}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      {getStatusLabel(doc.status)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(doc.updatedAt)}
                    </p>
                  </div>
                  <FontAwesomeIcon icon={faSpinner} spin className="text-blue-600 ml-3" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
