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
} from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';

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
  const { toast } = useToast();
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<number | null>(null);

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
          title: isDuplicate ? 'Duplikat wird erneut verarbeitet' : 'Dokument wird erneut verarbeitet',
          description: isDuplicate
            ? 'Dokument wurde mit neuem Hash zurück in den Consume-Ordner verschoben'
            : 'Verarbeitung wurde neu gestartet',
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
        title: 'Fehler',
        description: error.message || 'Dokument konnte nicht erneut verarbeitet werden',
        variant: 'destructive',
      });
    } finally {
      setRetrying(null);
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
              Warteschlange
            </CardTitle>
            <FontAwesomeIcon icon={faClock} className="text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueData.counts.pending}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Dokumente warten auf Verarbeitung
            </p>
          </CardContent>
        </Card>

        {/* Processing */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              In Bearbeitung
            </CardTitle>
            <FontAwesomeIcon icon={faSpinner} spin className="text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueData.counts.processing}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Dokumente werden verarbeitet
            </p>
          </CardContent>
        </Card>

        {/* Errors */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Fehler
            </CardTitle>
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueData.counts.error}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Fehlerhafte Dokumente
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
              Fehlerhafte Dokumente
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRetry(doc.id, doc.errorMessage)}
                    disabled={retrying === doc.id}
                    className="ml-3 shrink-0"
                  >
                    <FontAwesomeIcon
                      icon={faRotateRight}
                      className={cn("mr-2", retrying === doc.id && "animate-spin")}
                    />
                    Retry
                  </Button>
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
              Wartende Dokumente
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
              Dokumente in Bearbeitung
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
