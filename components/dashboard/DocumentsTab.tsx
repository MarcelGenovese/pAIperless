"use client"

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileAlt,
  faCheckCircle,
  faExclamationCircle,
  faSpinner,
  faClock,
  faSync
} from '@fortawesome/free-solid-svg-icons';
import DocumentUpload from './DocumentUpload';
import FolderContents from './FolderContents';

interface Document {
  id: string;
  filename: string;
  status: string;
  createdAt: string;
  errorMessage?: string;
}

export default function DocumentsTab() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDocuments = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/documents');
      const data = await response.json();
      setDocuments(data.documents || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load documents:', error);
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDocuments();
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadDocuments, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />;
      case 'ERROR':
        return <FontAwesomeIcon icon={faExclamationCircle} className="text-red-600" />;
      case 'PENDING':
      case 'OCR_IN_PROGRESS':
      case 'PREPROCESSING_COMPLETE':
        return <FontAwesomeIcon icon={faSpinner} spin className="text-blue-600" />;
      default:
        return <FontAwesomeIcon icon={faClock} className="text-yellow-600" />;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'PENDING': 'Ausstehend',
      'PREPROCESSING_COMPLETE': 'Vorverarbeitung abgeschlossen',
      'OCR_IN_PROGRESS': 'OCR läuft',
      'OCR_COMPLETE': 'OCR abgeschlossen',
      'UPLOADED_TO_PAPERLESS': 'An Paperless übertragen',
      'COMPLETED': 'Abgeschlossen',
      'ERROR': 'Fehler',
      'PENDING_CONFIGURATION': 'Konfiguration ausstehend',
    };
    return statusMap[status] || status;
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dokumente</h2>
          <p className="text-sm text-muted-foreground">
            Übersicht aller verarbeiteten Dokumente
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadDocuments}
          disabled={refreshing}
        >
          <FontAwesomeIcon
            icon={faSync}
            className={`mr-2 ${refreshing ? 'animate-spin' : ''}`}
          />
          Aktualisieren
        </Button>
      </div>

      {/* Upload Component */}
      <DocumentUpload onUploadComplete={loadDocuments} />

      {/* Folder Contents - Live Pipeline View */}
      <FolderContents />

      <Card>
        <CardHeader>
          <CardTitle>Verarbeitungshistorie</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Vollständige Historie aller verarbeiteten Dokumente aus der Datenbank
          </p>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-12">
              <FontAwesomeIcon icon={faFileAlt} className="text-gray-400 text-4xl mb-4" />
              <p className="text-muted-foreground">
                Noch keine Dokumente verarbeitet.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Legen Sie PDFs in den /consume Ordner, um zu beginnen.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-start justify-between py-3 px-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                >
                  <div className="flex items-start gap-3 flex-1">
                    {getStatusIcon(doc.status)}
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">{doc.filename}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {getStatusText(doc.status)}
                      </p>
                      {doc.errorMessage && (
                        <p className="text-xs text-red-600 mt-1">
                          {doc.errorMessage}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(doc.createdAt).toLocaleString('de-DE')}
                      </p>
                    </div>
                  </div>
                  {doc.status === 'ERROR' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await fetch(`/api/documents/${doc.id}/retry`, {
                            method: 'POST',
                          });
                          loadDocuments();
                        } catch (error) {
                          console.error('Failed to retry document:', error);
                        }
                      }}
                    >
                      Wiederholen
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
