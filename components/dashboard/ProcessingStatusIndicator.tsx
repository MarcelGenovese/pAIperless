"use client"

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faClock } from '@fortawesome/free-solid-svg-icons';

interface ActiveProcess {
  type: string;
  details?: string;
  startedAt: string;
  duration: number;
}

interface ProcessingStatus {
  hasActiveProcesses: boolean;
  activeProcesses: ActiveProcess[];
}

export default function ProcessingStatusIndicator() {
  const [status, setStatus] = useState<ProcessingStatus>({
    hasActiveProcesses: false,
    activeProcesses: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/processing-status');
      const data = await response.json();
      setStatus(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch processing status:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch immediately
    fetchStatus();

    // Poll every 3 seconds
    const interval = setInterval(fetchStatus, 3000);

    return () => clearInterval(interval);
  }, []);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getProcessLabel = (type: string): string => {
    switch (type) {
      case 'AI_DOCUMENT_PROCESSING':
        return 'AI Analyse läuft';
      case 'DOCUMENT_UPLOAD':
        return 'Upload läuft';
      case 'WORKER_CONSUME':
        return 'Verarbeitung läuft';
      default:
        return 'Verarbeitung läuft';
    }
  };

  if (loading) {
    return null;
  }

  if (!status.hasActiveProcesses) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      {status.activeProcesses.map((process, index) => (
        <div
          key={index}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md"
        >
          <FontAwesomeIcon
            icon={faSpinner}
            spin
            className="text-blue-600 dark:text-blue-400"
          />
          <div className="flex flex-col">
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
              {getProcessLabel(process.type)}
            </span>
            {process.details && (
              <span className="text-xs text-blue-600 dark:text-blue-400">
                {process.details}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
            <FontAwesomeIcon icon={faClock} className="text-xs" />
            {formatDuration(process.duration)}
          </div>
        </div>
      ))}
    </div>
  );
}
