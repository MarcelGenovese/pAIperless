"use client"

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileAlt,
  faCheckCircle,
  faExclamationCircle,
  faSpinner,
  faClock,
  faTrash,
  faChevronLeft,
  faChevronRight,
  faBrain,
  faRobot,
  faExternalLinkAlt
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
  paperlessId?: number;
  ocrPageCount?: number;
  geminiTokensSent?: number;
  geminiTokensRecv?: number;
}

interface AIAnalysis {
  id: number;
  level: string;
  message: string;
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  error: string | null;
  createdAt: string;
}

export default function DocumentsTab() {
  const t = useTranslations('documents');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [aiAnalyses, setAiAnalyses] = useState<Record<string, AIAnalysis[]>>({});
  const [loadingAnalysis, setLoadingAnalysis] = useState<string | null>(null);
  const [paperlessUrl, setPaperlessUrl] = useState<string>('');
  const itemsPerPage = 10;

  const loadDocuments = async () => {
    try {
      const response = await fetch('/api/documents');
      const data = await response.json();
      setDocuments(data.documents || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load documents:', error);
      setLoading(false);
    }
  };

  const loadAIAnalysis = async (docId: string) => {
    if (aiAnalyses[docId]) {
      // Already loaded
      return;
    }

    setLoadingAnalysis(docId);
    try {
      const response = await fetch(`/api/documents/${docId}/ai-analysis`);
      const data = await response.json();
      setAiAnalyses(prev => ({
        ...prev,
        [docId]: data.analyses || [],
      }));
    } catch (error) {
      console.error('Failed to load AI analysis:', error);
    } finally {
      setLoadingAnalysis(null);
    }
  };

  const toggleExpanded = (docId: string) => {
    if (expandedDocId === docId) {
      setExpandedDocId(null);
    } else {
      setExpandedDocId(docId);
      loadAIAnalysis(docId);
    }
  };

  const openInPaperless = (paperlessId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    if (paperlessUrl && paperlessId) {
      const url = `${paperlessUrl}/documents/${paperlessId}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  useEffect(() => {
    loadDocuments();
    loadPaperlessUrl();
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadDocuments, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadPaperlessUrl = async () => {
    try {
      const response = await fetch('/api/setup/load-config?step=1');
      const data = await response.json();
      if (data.paperlessUrl) {
        setPaperlessUrl(data.paperlessUrl);
      }
    } catch (error) {
      console.error('Failed to load Paperless URL:', error);
    }
  };

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
      <div>
        <h2 className="text-2xl font-bold">Dokumente</h2>
        <p className="text-sm text-muted-foreground">
          Übersicht aller verarbeiteten Dokumente (automatische Aktualisierung alle 10 Sekunden)
        </p>
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
                    className="border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  >
                    {/* Main Document Row */}
                    <div className="flex items-start gap-3 py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(doc.id)}
                        onChange={() => toggleSelect(doc.id)}
                        className="mt-1 w-4 h-4 rounded border-gray-300 cursor-pointer"
                      />
                      {getStatusIcon(doc.status)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3
                            className="font-semibold text-sm cursor-pointer hover:text-blue-600 transition-colors flex items-center gap-2"
                            onClick={() => toggleExpanded(doc.id)}
                          >
                            {doc.filename}
                          </h3>
                          {doc.paperlessId && doc.status === 'COMPLETED' && (
                            <button
                              onClick={(e) => openInPaperless(doc.paperlessId!, e)}
                              className="text-blue-600 hover:text-blue-800 transition-colors"
                              title="In Paperless öffnen"
                            >
                              <FontAwesomeIcon icon={faExternalLinkAlt} className="text-xs" />
                            </button>
                          )}
                        </div>
                        <p
                          className="text-xs text-muted-foreground mt-1 cursor-pointer"
                          onClick={() => toggleExpanded(doc.id)}
                        >
                          {getStatusText(doc.status)}
                        </p>

                        {/* Quick Status Summary */}
                        {doc.status === 'COMPLETED' && !expandedDocId && (
                          <div
                            className="mt-2 flex flex-wrap gap-2"
                            onClick={() => toggleExpanded(doc.id)}
                          >
                            {doc.ocrPageCount && doc.ocrPageCount > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs cursor-pointer">
                                <FontAwesomeIcon icon={faFileAlt} className="mr-1" />
                                {doc.ocrPageCount} Seite(n)
                              </span>
                            )}
                            {doc.geminiTokensSent && doc.geminiTokensSent > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs cursor-pointer">
                                <FontAwesomeIcon icon={faBrain} className="mr-1" />
                                KI Analysiert
                              </span>
                            )}
                            {doc.paperlessId && (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs cursor-pointer hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                                onClick={(e) => openInPaperless(doc.paperlessId!, e)}
                                title="In Paperless öffnen"
                              >
                                <FontAwesomeIcon icon={faCheckCircle} className="mr-1" />
                                Paperless #{doc.paperlessId}
                                <FontAwesomeIcon icon={faExternalLinkAlt} className="ml-1 text-xs" />
                              </span>
                            )}
                          </div>
                        )}

                        {doc.errorMessage && (
                          <div className="mt-2">
                            <div className="flex items-start gap-2 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                              <FontAwesomeIcon icon={faExclamationCircle} className="text-red-600 mt-0.5" />
                              <p className="text-xs text-red-600 dark:text-red-400 flex-1">
                                {doc.errorMessage}
                              </p>
                            </div>
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground mt-2">
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

                    {/* Expanded Details with Tabs */}
                    {expandedDocId === doc.id && (
                      <div className="border-t px-4 py-3 bg-gray-50 dark:bg-gray-900">
                        <Tabs defaultValue="ocr" className="w-full">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="ocr">
                              <FontAwesomeIcon icon={faFileAlt} className="mr-2" />
                              OCR Verarbeitung
                            </TabsTrigger>
                            <TabsTrigger value="ai-tagging">
                              <FontAwesomeIcon icon={faRobot} className="mr-2" />
                              KI-Tagging
                            </TabsTrigger>
                          </TabsList>

                          <TabsContent value="ocr" className="mt-4 space-y-3">
                            {doc.ocrPageCount && doc.ocrPageCount > 0 ? (
                              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center gap-2 mb-2">
                                  <FontAwesomeIcon icon={faCheckCircle} className="text-blue-600" />
                                  <span className="font-semibold text-sm text-blue-900 dark:text-blue-100">
                                    Document AI OCR
                                  </span>
                                </div>
                                <p className="text-xs text-blue-800 dark:text-blue-200">
                                  {doc.ocrPageCount} Seite(n) erfolgreich verarbeitet
                                </p>
                              </div>
                            ) : (
                              <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
                                <p className="text-xs text-muted-foreground">
                                  Keine Document AI OCR Verarbeitung (übersprungen oder Tesseract verwendet)
                                </p>
                              </div>
                            )}

                            {doc.paperlessId && (
                              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />
                                    <span className="font-semibold text-sm text-green-900 dark:text-green-100">
                                      An Paperless übertragen
                                    </span>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => openInPaperless(doc.paperlessId!, e)}
                                    className="text-xs"
                                  >
                                    <FontAwesomeIcon icon={faExternalLinkAlt} className="mr-1" />
                                    In Paperless öffnen
                                  </Button>
                                </div>
                                <p className="text-xs text-green-800 dark:text-green-200">
                                  Dokument-ID in Paperless: {doc.paperlessId}
                                </p>
                              </div>
                            )}
                          </TabsContent>

                          <TabsContent value="ai-tagging" className="mt-4">
                            {loadingAnalysis === doc.id ? (
                              <div className="flex items-center justify-center py-6">
                                <FontAwesomeIcon icon={faSpinner} spin className="text-accent text-xl mr-2" />
                                <span className="text-sm text-muted-foreground">Lade KI-Analyse...</span>
                              </div>
                            ) : aiAnalyses[doc.id] && aiAnalyses[doc.id].length > 0 ? (
                              <div className="space-y-3">
                                {aiAnalyses[doc.id].map((analysis) => (
                                  <div
                                    key={analysis.id}
                                    className={`p-3 rounded-lg border ${
                                      analysis.level === 'ERROR'
                                        ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                                        : 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800'
                                    }`}
                                  >
                                    <div className="flex items-start gap-2 mb-2">
                                      <FontAwesomeIcon
                                        icon={analysis.level === 'ERROR' ? faExclamationCircle : faCheckCircle}
                                        className={analysis.level === 'ERROR' ? 'text-red-600' : 'text-purple-600'}
                                      />
                                      <div className="flex-1">
                                        <span className={`font-semibold text-sm ${
                                          analysis.level === 'ERROR'
                                            ? 'text-red-900 dark:text-red-100'
                                            : 'text-purple-900 dark:text-purple-100'
                                        }`}>
                                          {analysis.message}
                                        </span>
                                        {analysis.tokensTotal > 0 && (
                                          <p className={`text-xs mt-1 ${
                                            analysis.level === 'ERROR'
                                              ? 'text-red-700 dark:text-red-300'
                                              : 'text-purple-700 dark:text-purple-300'
                                          }`}>
                                            Tokens: {analysis.tokensInput.toLocaleString('de-DE')} Input, {analysis.tokensOutput.toLocaleString('de-DE')} Output
                                            ({analysis.tokensTotal.toLocaleString('de-DE')} Total)
                                          </p>
                                        )}
                                        {analysis.error && (
                                          <p className="text-xs mt-2 text-red-600 dark:text-red-400">
                                            Fehler: {analysis.error}
                                          </p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-2">
                                          {new Date(analysis.createdAt).toLocaleString('de-DE')}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : doc.geminiTokensSent && doc.geminiTokensSent > 0 ? (
                              <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
                                <div className="flex items-center gap-2 mb-2">
                                  <FontAwesomeIcon icon={faCheckCircle} className="text-purple-600" />
                                  <span className="font-semibold text-sm text-purple-900 dark:text-purple-100">
                                    Gemini AI Analyse
                                  </span>
                                </div>
                                <p className="text-xs text-purple-800 dark:text-purple-200">
                                  Dokument analysiert mit {doc.geminiTokensSent.toLocaleString('de-DE')} Tokens
                                </p>
                              </div>
                            ) : (
                              <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
                                <p className="text-xs text-muted-foreground">
                                  Keine KI-Analyse-Daten verfügbar
                                </p>
                              </div>
                            )}
                          </TabsContent>
                        </Tabs>
                      </div>
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
