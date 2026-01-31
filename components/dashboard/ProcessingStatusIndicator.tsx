"use client"

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faClock, faHandPaper } from '@fortawesome/free-solid-svg-icons';

interface ActiveProcess {
  type: string;
  details?: string;
  startedAt: string;
  duration: number;
  progress?: {
    current?: number;
    total?: number;
    currentItem?: string;
    message?: string;
  };
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
  const [emergencyStop, setEmergencyStop] = useState(false);

  const fetchStatus = async () => {
    try {
      // Fetch processing status
      const response = await fetch('/api/processing-status');
      const data = await response.json();
      setStatus(data);

      // Fetch emergency stop status
      const eStopResponse = await fetch('/api/emergency-stop');
      const eStopData = await eStopResponse.json();
      setEmergencyStop(eStopData.active || false);

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
        return 'File Watcher aktiv';
      default:
        return 'Verarbeitung läuft';
    }
  };

  if (loading) {
    return null;
  }

  // If emergency stop is active, show warning instead of processes
  if (emergencyStop) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
        <FontAwesomeIcon
          icon={faHandPaper}
          className="text-red-600 dark:text-red-400"
        />
        <span className="text-xs font-medium text-red-700 dark:text-red-300">
          🚨 Alle Prozesse gestoppt
        </span>
      </div>
    );
  }

  if (!status.hasActiveProcesses) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {status.activeProcesses.map((process, index) => (
        <div
          key={index}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md w-full"
        >
          <FontAwesomeIcon
            icon={faSpinner}
            spin
            className="text-blue-600 dark:text-blue-400"
          />
          <div className="flex flex-col">
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
              {getProcessLabel(process.type)}
              {process.progress && process.progress.total && (
                <span className="ml-2">({process.progress.current}/{process.progress.total})</span>
              )}
            </span>
            {process.progress?.currentItem && (
              <span className="text-xs text-blue-600 dark:text-blue-400 truncate max-w-[200px]">
                {process.progress.currentItem}
              </span>
            )}
            {process.progress?.message && !process.progress.currentItem && (
              <span className="text-xs text-blue-600 dark:text-blue-400">
                {process.progress.message}
              </span>
            )}
            {process.details && !process.progress?.message && !process.progress?.currentItem && (
              <span className="text-xs text-blue-600 dark:text-blue-400">
                {process.details}
              </span>
            )}
          </div>
          {/* Only show duration for non-watcher processes */}
          {process.type !== 'WORKER_CONSUME' && (
            <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
              <FontAwesomeIcon icon={faClock} className="text-xs" />
              {formatDuration(process.duration)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
