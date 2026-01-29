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
  faSync,
  faTrash,
  faChevronLeft,
  faChevronRight
} from '@fortawesome/free-solid-svg-icons';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const itemsPerPage = 10;

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

  const handleDeleteSelected = async () => {
    setDeleting(true);
    try {
      const response = await fetch('/api/documents/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });

      if (response.ok) {
        toast({
          title: 'Erfolgreich gelöscht',
          description: `${selectedIds.length} Dokument(e) gelöscht`,
          variant: 'success',
        });
        setSelectedIds([]);
        setShowDeleteConfirm(false);
        loadDocuments();
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Dokumente konnten nicht gelöscht werden',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedDocuments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedDocuments.map(d => d.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

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

  // Pagination
  const totalPages = Math.ceil(documents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDocuments = documents.slice(startIndex, startIndex + itemsPerPage);

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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Verarbeitungshistorie</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Vollständige Historie aller verarbeiteten Dokumente aus der Datenbank
              </p>
            </div>
            {selectedIds.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <FontAwesomeIcon icon={faTrash} className="mr-2" />
                Ausgewählte löschen ({selectedIds.length})
              </Button>
            )}
          </div>
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
            <>
              <div className="space-y-3">
                {/* Select All */}
                {paginatedDocuments.length > 0 && (
                  <div className="flex items-center gap-3 py-2 px-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === paginatedDocuments.length && paginatedDocuments.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                    />
                    <span className="text-sm font-medium">Alle auswählen</span>
                  </div>
                )}

                {paginatedDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-start gap-3 py-3 px-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(doc.id)}
                      onChange={() => toggleSelect(doc.id)}
                      className="mt-1 w-4 h-4 rounded border-gray-300 cursor-pointer"
                    />
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Seite {currentPage} von {totalPages} ({documents.length} Dokumente gesamt)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <FontAwesomeIcon icon={faChevronLeft} className="mr-2" />
                      Zurück
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Weiter
                      <FontAwesomeIcon icon={faChevronRight} className="ml-2" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Dokumente löschen?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Möchten Sie wirklich {selectedIds.length} Dokument(e) aus der Datenbank löschen?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Abbrechen
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteSelected}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                    Löschen...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faTrash} className="mr-2" />
                    Löschen
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
