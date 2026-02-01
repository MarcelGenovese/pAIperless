"use client"

import { useState, useRef, DragEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUpload,
  faSpinner,
  faCheckCircle,
  faExclamationCircle,
  faFileAlt,
  faTrash
} from '@fortawesome/free-solid-svg-icons';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';

interface UploadFile {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  progress?: number;
}

interface DocumentUploadProps {
  onUploadComplete?: () => void;
}

export default function DocumentUpload({ onUploadComplete }: DocumentUploadProps) {
  const t = useTranslations('dashboard');

  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    const uploadFiles: UploadFile[] = newFiles
      .filter(file => {
        // Only allow PDFs
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          toast({
            title: t('ungueltiger_dateityp'),
            description: `${file.name} ist keine PDF-Datei`,
            variant: 'destructive',
          });
          return false;
        }
        // Check file size (max 100MB)
        if (file.size > 100 * 1024 * 1024) {
          toast({
            title: t('datei_zu_gross'),
            description: `${file.name} überschreitet die maximale Größe von 100MB`,
            variant: 'destructive',
          });
          return false;
        }
        return true;
      })
      .map(file => ({
        file,
        status: 'pending' as const,
      }));

    setFiles(prev => [...prev, ...uploadFiles]);

    // Auto-upload after adding files
    if (uploadFiles.length > 0) {
      setTimeout(() => {
        uploadFilesAuto(uploadFiles);
      }, 100);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setFiles([]);
  };

  const uploadFilesAuto = async (filesToUpload?: UploadFile[]) => {
    const targetFiles = filesToUpload || files.filter(f => f.status === 'pending');
    if (targetFiles.length === 0) return;

    console.log('[Upload] Starting upload for', targetFiles.length, 'files');

    setIsUploading(true);

    // Mark files as uploading
    setFiles(prev =>
      prev.map(f =>
        targetFiles.find(tf => tf.file.name === f.file.name)
          ? { ...f, status: 'uploading' as const, progress: 0 }
          : f
      )
    );

    const formData = new FormData();
    targetFiles.forEach(({ file }) => {
      console.log('[Upload] Adding file:', file.name, file.size, 'bytes');
      formData.append('files', file);
    });

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setFiles(prev =>
          prev.map(f => {
            if (f.status === 'uploading' && (f.progress || 0) < 90) {
              return { ...f, progress: (f.progress || 0) + 10 };
            }
            return f;
          })
        );
      }, 200);

      console.log('[Upload] Sending request to /api/documents/upload');

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include', // WICHTIG: Sendet Cookies mit!
      });

      console.log('[Upload] Response status:', response.status);
      console.log('[Upload] Response headers:', Object.fromEntries(response.headers.entries()));

      clearInterval(progressInterval);

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      console.log('[Upload] Content-Type:', contentType);

      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[Upload] Non-JSON response:', text.substring(0, 500));

        // Show user-friendly error message
        let errorMsg = `Server-Fehler (${response.status}): `;
        if (text.includes('Unauthorized')) {
          errorMsg += 'Nicht autorisiert. Bitte neu anmelden.';
        } else if (text.includes('Setup not complete')) {
          errorMsg += 'Setup nicht abgeschlossen.';
        } else if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          // HTML error page returned - show generic error
          errorMsg += 'Interner Server-Fehler. Bitte versuchen Sie es erneut oder prüfen Sie die Server-Logs.';
        } else {
          // Plain text error - show first 100 chars
          errorMsg += text.substring(0, 100);
        }

        throw new Error(errorMsg);
      }

      const result = await response.json();
      console.log('[Upload] Response result:', result);

      if (response.ok) {
        console.log('[Upload] ✅ Upload successful:', result.uploaded.length, 'files');

        // Mark all as success with 100% progress
        setFiles(prev =>
          prev.map(f => {
            const uploaded = targetFiles.find(tf => tf.file.name === f.file.name);
            return uploaded
              ? { ...f, status: 'success' as const, progress: 100 }
              : f;
          })
        );

        // Show warnings if any files were renamed
        if (result.errors && result.errors.length > 0) {
          console.warn('[Upload] Some files had issues:', result.errors);
        }

        toast({
          title: t('upload_erfolgreich'),
          description: result.message || `${result.uploaded.length} Datei(en) hochgeladen`,
        });

        // Clear files after 2 seconds
        setTimeout(() => {
          setFiles([]);
        }, 2000);

        // Notify parent to refresh
        if (onUploadComplete) {
          onUploadComplete();
        }
      } else {
        // Handle partial errors
        if (result.errors && result.uploaded) {
          console.log('[Upload] Partial success:', result.uploaded.length, 'uploaded,', result.errors.length, 'failed');

          // Log detailed error information
          result.errors.forEach((err: any) => {
            console.error(`[Upload] ❌ ${err.filename}: ${err.error}`);
          });

          toast({
            title: t('upload_teilweise_erfolgreich'),
            description: `${result.uploaded.length} erfolgreich, ${result.errors.length} fehlgeschlagen`,
            variant: 'destructive',
          });

          // Mark files based on errors
          setFiles(prev =>
            prev.map(f => {
              const error = result.errors.find((e: any) => e.filename === f.file.name);
              const uploaded = targetFiles.find(tf => tf.file.name === f.file.name);
              if (!uploaded) return f;

              if (error) {
                console.log(`[Upload] Setting error for ${f.file.name}:`, error.error);
              }

              return {
                ...f,
                status: error ? 'error' : 'success',
                error: error?.error,
                progress: error ? undefined : 100,
              } as UploadFile;
            })
          );
        } else if (result.error && result.errors) {
          // All uploads failed (400 error with errors array)
          console.error('[Upload] All uploads failed:', result.error);

          result.errors.forEach((err: any) => {
            console.error(`[Upload] ❌ ${err.filename}: ${err.error}`);
          });

          setFiles(prev =>
            prev.map(f => {
              const error = result.errors.find((e: any) => e.filename === f.file.name);
              const uploaded = targetFiles.find(tf => tf.file.name === f.file.name);
              if (!uploaded) return f;

              return {
                ...f,
                status: 'error' as const,
                error: error?.error || 'Upload fehlgeschlagen',
                progress: undefined,
              } as UploadFile;
            })
          );

          toast({
            title: t('alle_uploads_fehlgeschlagen'),
            description: result.errors.length === 1
              ? result.errors[0].error
              : `${result.errors.length} Dateien konnten nicht hochgeladen werden`,
            variant: 'destructive',
          });

          return; // Don't throw, we've handled the error
        } else {
          console.error('[Upload] Complete failure:', result.error);
          throw new Error(result.error || 'Upload fehlgeschlagen');
        }
      }
    } catch (error: any) {
      console.error('[Upload] Exception during upload:', error);
      setFiles(prev =>
        prev.map(f => {
          const uploaded = targetFiles.find(tf => tf.file.name === f.file.name);
          return uploaded
            ? { ...f, status: 'error' as const, error: error.message }
            : f;
        })
      );

      toast({
        title: t('upload_fehlgeschlagen'),
        description: error.message || 'Ein Fehler ist aufgetreten',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'success':
        return <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />;
      case 'error':
        return <FontAwesomeIcon icon={faExclamationCircle} className="text-red-600" />;
      case 'uploading':
        return <FontAwesomeIcon icon={faSpinner} spin className="text-blue-600" />;
      default:
        return <FontAwesomeIcon icon={faFileAlt} className="text-gray-600" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FontAwesomeIcon icon={faUpload} />
          Dokumente hochladen
        </CardTitle>
        <CardDescription>
          Laden Sie PDF-Dateien hoch - Upload startet automatisch
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop Zone */}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-all duration-200
            ${isDragging
              ? 'border-primary bg-primary/5 scale-105'
              : 'border-gray-300 dark:border-gray-700 hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-900'
            }
          `}
          onClick={() => fileInputRef.current?.click()}
        >
          <FontAwesomeIcon
            icon={faUpload}
            className={`text-4xl mb-4 transition-colors ${
              isDragging ? 'text-primary' : 'text-gray-400'
            }`}
          />
          <p className="text-lg font-semibold mb-2">
            {isDragging ? 'Dateien hier ablegen' : 'Dateien hochladen'}
          </p>
          <p className="text-sm text-muted-foreground mb-2">
            Ziehen Sie PDF-Dateien hierher oder klicken Sie zum Auswählen
          </p>
          <p className="text-xs text-muted-foreground">
            Maximale Dateigröße: 100MB pro Datei
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {files.length} Datei(en) {isUploading ? 'werden hochgeladen' : 'ausgewählt'}
              </h3>
              {!isUploading && files.some(f => f.status === 'success' || f.status === 'error') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                >
                  <FontAwesomeIcon icon={faTrash} className="mr-2" />
                  Liste leeren
                </Button>
              )}
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {files.map((uploadFile, index) => (
                <div
                  key={index}
                  className="p-3 border rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getStatusIcon(uploadFile.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {uploadFile.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(uploadFile.file.size)}
                        </p>
                        {uploadFile.error && (
                          <p className="text-xs text-red-600 mt-1">
                            {uploadFile.error}
                          </p>
                        )}
                      </div>
                    </div>
                    {!isUploading && uploadFile.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </Button>
                    )}
                  </div>
                  {/* Progress Bar */}
                  {uploadFile.status === 'uploading' && uploadFile.progress !== undefined && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadFile.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
