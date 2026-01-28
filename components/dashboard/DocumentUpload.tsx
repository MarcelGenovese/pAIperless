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

interface UploadFile {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

interface DocumentUploadProps {
  onUploadComplete?: () => void;
}

export default function DocumentUpload({ onUploadComplete }: DocumentUploadProps) {
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
            title: 'Ungültiger Dateityp',
            description: `${file.name} ist keine PDF-Datei`,
            variant: 'destructive',
          });
          return false;
        }
        // Check file size (max 100MB)
        if (file.size > 100 * 1024 * 1024) {
          toast({
            title: 'Datei zu groß',
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
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setFiles([]);
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setIsUploading(true);

    const formData = new FormData();
    files.forEach(({ file }) => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        // Mark all as success
        setFiles(prev =>
          prev.map(f => ({
            ...f,
            status: 'success' as const,
          }))
        );

        toast({
          title: 'Upload erfolgreich',
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
          toast({
            title: 'Upload teilweise erfolgreich',
            description: `${result.uploaded.length} erfolgreich, ${result.errors.length} fehlgeschlagen`,
            variant: 'destructive',
          });

          // Mark files based on errors
          setFiles(prev =>
            prev.map(f => {
              const error = result.errors.find((e: any) => e.filename === f.file.name);
              return {
                ...f,
                status: error ? 'error' : 'success',
                error: error?.error,
              } as UploadFile;
            })
          );
        } else {
          throw new Error(result.error || 'Upload fehlgeschlagen');
        }
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      setFiles(prev =>
        prev.map(f => ({
          ...f,
          status: 'error' as const,
          error: error.message,
        }))
      );

      toast({
        title: 'Upload fehlgeschlagen',
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
          Laden Sie PDF-Dateien hoch, um sie automatisch zu verarbeiten
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
                {files.length} Datei(en) ausgewählt
              </h3>
              {!isUploading && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                >
                  <FontAwesomeIcon icon={faTrash} className="mr-2" />
                  Alle entfernen
                </Button>
              )}
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {files.map((uploadFile, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
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
              ))}
            </div>

            {/* Upload Button */}
            <Button
              onClick={uploadFiles}
              disabled={isUploading || files.every(f => f.status !== 'pending')}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                  Wird hochgeladen...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faUpload} className="mr-2" />
                  {files.length} Datei(en) hochladen
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
