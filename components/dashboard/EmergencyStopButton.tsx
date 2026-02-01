"use client"

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHandPaper, faPlay, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useToast } from '@/hooks/use-toast';
import {
import { useTranslations } from 'next-intl';

  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function EmergencyStopButton() {
  const t = useTranslations('dashboard');

  const { toast } = useToast();
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState<'activate' | 'deactivate'>('activate');

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/emergency-stop');
      const data = await response.json();
      setIsActive(data.active || false);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch emergency stop status:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Poll status every 5 seconds
    const interval = setInterval(fetchStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleConfirm = (action: 'activate' | 'deactivate') => {
    setActionToConfirm(action);
    setShowConfirm(true);
  };

  const handleToggle = async () => {
    setToggling(true);
    setShowConfirm(false);

    try {
      const response = await fetch('/api/emergency-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activate: actionToConfirm === 'activate' }),
      });

      const data = await response.json();

      if (data.success) {
        setIsActive(data.active);
        toast({
          title: data.active ? '🚨 Emergency Stop aktiviert' : '✅ Emergency Stop deaktiviert',
          description: data.message,
          variant: data.active ? 'destructive' : 'default',
        });
      } else {
        throw new Error(data.error || 'Failed to toggle emergency stop');
      }
    } catch (error) {
      console.error('Failed to toggle emergency stop:', error);
      toast({
        title: 'Fehler',
        description: 'Emergency Stop konnte nicht geändert werden',
        variant: 'destructive',
      });
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
        <span className="hidden sm:inline">{t('loading')}</span>
      </Button>
    );
  }

  return (
    <>
      <Button
        variant={isActive ? 'destructive' : 'outline'}
        size="sm"
        onClick={() => handleConfirm(isActive ? 'deactivate' : 'activate')}
        disabled={toggling}
        className={`w-full justify-start ${isActive ? 'animate-pulse' : ''}`}
        title={isActive ? 'Emergency Stop ist AKTIV - klicken zum Deaktivieren' : 'Emergency Stop aktivieren'}
      >
        <FontAwesomeIcon
          icon={toggling ? faSpinner : isActive ? faHandPaper : faHandPaper}
          spin={toggling}
          className="mr-2 w-4 h-4"
        />
        {isActive ? '🚨 STOP AKTIV' : 'Emergency Stop'}
      </Button>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionToConfirm === 'activate'
                ? '🚨 Emergency Stop aktivieren?'
                : '✅ Emergency Stop deaktivieren?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionToConfirm === 'activate' ? (
                <>
                  <strong className="text-red-600 dark:text-red-400">
                    Dies stoppt ALLE laufenden Verarbeitungen sofort:
                  </strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>AI-Dokumentenanalyse wird gestoppt</li>
                    <li>Datei-Verarbeitung wird gestoppt</li>
                    <li>Worker wird pausiert</li>
                    <li>Webhooks werden blockiert</li>
                    <li>Polling wird pausiert</li>
                  </ul>
                  <p className="mt-3 text-amber-600 dark:text-amber-400">
                    ⚠️ Verwenden Sie dies nur in Notfällen!
                  </p>
                </>
              ) : (
                <>
                  Dies reaktiviert alle Verarbeitungsprozesse:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Worker kann Dateien verarbeiten</li>
                    <li>AI-Analyse kann starten</li>
                    <li>Webhooks werden akzeptiert</li>
                    <li>{t('polling_laeuft_weiter')}</li>
                  </ul>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggle}
              className={actionToConfirm === 'activate' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {actionToConfirm === 'activate' ? '🚨 Ja, stoppen!' : '✅ Ja, fortsetzen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
