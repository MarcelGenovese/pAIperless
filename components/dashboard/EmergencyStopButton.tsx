"use client"

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHandPaper, faPlay, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslations } from 'next-intl';

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
          title: data.active ? t('emergency_stop_activated') : t('emergency_stop_deactivated'),
          description: data.message,
          variant: data.active ? 'destructive' : 'default',
        });
      } else {
        throw new Error(data.error || 'Failed to toggle emergency stop');
      }
    } catch (error) {
      console.error('Failed to toggle emergency stop:', error);
      toast({
        title: t('fehler'),
        description: t('emergency_stop_konnte_nicht_geaendert_werden'),
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
        title={isActive ? t('emergency_stop_is_active_click_to_deactivate') : t('emergency_stop_activate')}
      >
        <FontAwesomeIcon
          icon={toggling ? faSpinner : isActive ? faHandPaper : faHandPaper}
          spin={toggling}
          className="mr-2 w-4 h-4"
        />
        {isActive ? t('stop_active') : t('emergency_stop')}
      </Button>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionToConfirm === 'activate'
                ? t('emergency_stop_activate_question')
                : t('emergency_stop_deactivate_question')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionToConfirm === 'activate' ? (
                <>
                  <strong className="text-red-600 dark:text-red-400">
                    {t('this_stops_all_running_processes_immediately')}
                  </strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>{t('ai_dokumentenanalyse_wird_gestoppt')}</li>
                    <li>{t('datei_verarbeitung_wird_gestoppt')}</li>
                    <li>{t('worker_wird_pausiert')}</li>
                    <li>{t('webhooks_werden_blockiert')}</li>
                    <li>{t('polling_wird_pausiert')}</li>
                  </ul>
                  <p className="mt-3 text-amber-600 dark:text-amber-400">
                    {t('use_only_in_emergencies')}
                  </p>
                </>
              ) : (
                <>
                  {t('this_reactivates_all_processing')}
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>{t('worker_can_process_files')}</li>
                    <li>{t('ai_analysis_can_start')}</li>
                    <li>{t('webhooks_werden_akzeptiert')}</li>
                    <li>{t('polling_laeuft_weiter')}</li>
                  </ul>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggle}
              className={actionToConfirm === 'activate' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {actionToConfirm === 'activate' ? t('yes_stop') : t('yes_continue')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
