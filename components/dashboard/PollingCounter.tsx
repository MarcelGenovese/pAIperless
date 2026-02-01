"use client"

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faSpinner } from '@fortawesome/free-solid-svg-icons';

interface PollingStatus {
  aiTodo: {
    enabled: boolean;
    interval: number; // minutes
    lastRun?: string;
    nextRun?: string;
  };
  action: {
    enabled: boolean;
    interval: number; // minutes
    lastRun?: string;
    nextRun?: string;
  };
  consume: {
    enabled: boolean;
    interval: number; // minutes
    lastRun?: string;
    nextRun?: string;
  };
}

export default function PollingCounter() {
  const [status, setStatus] = useState<PollingStatus | null>(null);
  const [aiTodoCountdown, setAiTodoCountdown] = useState<number | null>(null);
  const [actionCountdown, setActionCountdown] = useState<number | null>(null);
  const [consumeCountdown, setConsumeCountdown] = useState<number | null>(null);

  useEffect(() => {
    // Load polling status
    const loadStatus = async () => {
      try {
        const response = await fetch('/api/polling/status');
        const data = await response.json();
        setStatus(data);
      } catch (error) {
        console.error('Failed to load polling status:', error);
      }
    };

    loadStatus();
    // Refresh status every 10 seconds
    const interval = setInterval(loadStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!status) return;

    // Calculate initial countdowns immediately when status loads
    const calculateCountdowns = () => {
      const now = Date.now();

      if (status?.aiTodo?.enabled && status.aiTodo.nextRun) {
        const next = new Date(status.aiTodo.nextRun).getTime();
        const diff = Math.max(0, Math.floor((next - now) / 1000));
        setAiTodoCountdown(diff);
      } else {
        setAiTodoCountdown(null);
      }

      if (status?.action?.enabled && status.action.nextRun) {
        const next = new Date(status.action.nextRun).getTime();
        const diff = Math.max(0, Math.floor((next - now) / 1000));
        setActionCountdown(diff);
      } else {
        setActionCountdown(null);
      }

      if (status?.consume?.enabled && status.consume.nextRun) {
        const next = new Date(status.consume.nextRun).getTime();
        const diff = Math.max(0, Math.floor((next - now) / 1000));
        setConsumeCountdown(diff);
      } else {
        setConsumeCountdown(null);
      }
    };

    // Calculate immediately
    calculateCountdowns();

    // Update countdowns every second
    const timer = setInterval(calculateCountdowns, 1000);

    return () => clearInterval(timer);
  }, [status]);

  if (!status || !status.aiTodo || !status.action || !status.consume) {
    return null;
  }

  const formatCountdown = (seconds: number | null): string => {
    if (seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const hasActivePolling = status?.aiTodo?.enabled || status?.action?.enabled || status?.consume?.enabled;

  if (!hasActivePolling) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        Nächstes Polling
      </h3>

      {status?.consume?.enabled && (
        <div className="px-3 py-2 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-600 dark:text-gray-400">Consume Folder</span>
            <FontAwesomeIcon
              icon={consumeCountdown !== null && consumeCountdown === 0 ? faSpinner : faClock}
              className={`w-3 h-3 text-purple-600 dark:text-purple-400 ${consumeCountdown === 0 ? 'animate-spin' : ''}`}
            />
          </div>
          <div className="font-mono text-lg font-bold text-purple-600 dark:text-purple-400">
            {formatCountdown(consumeCountdown)}
          </div>
          <div className="text-gray-500 dark:text-gray-500 mt-1">
            alle {status.consume.interval} Min
          </div>
        </div>
      )}

      {status?.aiTodo?.enabled && (
        <div className="px-3 py-2 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-600 dark:text-gray-400">AI Tagging</span>
            <FontAwesomeIcon
              icon={aiTodoCountdown !== null && aiTodoCountdown === 0 ? faSpinner : faClock}
              className={`w-3 h-3 text-blue-600 dark:text-blue-400 ${aiTodoCountdown === 0 ? 'animate-spin' : ''}`}
            />
          </div>
          <div className="font-mono text-lg font-bold text-blue-600 dark:text-blue-400">
            {formatCountdown(aiTodoCountdown)}
          </div>
          <div className="text-gray-500 dark:text-gray-500 mt-1">
            alle {status.aiTodo.interval} Min
          </div>
        </div>
      )}

      {status?.action?.enabled && (
        <div className="px-3 py-2 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-600 dark:text-gray-400">Action Check</span>
            <FontAwesomeIcon
              icon={actionCountdown !== null && actionCountdown === 0 ? faSpinner : faClock}
              className={`w-3 h-3 text-green-600 dark:text-green-400 ${actionCountdown === 0 ? 'animate-spin' : ''}`}
            />
          </div>
          <div className="font-mono text-lg font-bold text-green-600 dark:text-green-400">
            {formatCountdown(actionCountdown)}
          </div>
          <div className="text-gray-500 dark:text-gray-500 mt-1">
            alle {status.action.interval} Min
          </div>
        </div>
      )}
    </div>
  );
}
