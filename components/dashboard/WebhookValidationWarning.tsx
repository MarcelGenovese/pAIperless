"use client"

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faSpinner, faSync } from '@fortawesome/free-solid-svg-icons';
import { useToast } from '@/hooks/use-toast';

export default function WebhookValidationWarning() {
  const { toast } = useToast();
  const [validationStatus, setValidationStatus] = useState<{
    valid: boolean;
    workflows: Array<{
      id: number;
      name: string;
      hasWebhook: boolean;
      apiKeyMatch: boolean;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    checkValidation();
    // Check every 5 minutes
    const interval = setInterval(checkValidation, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkValidation = async () => {
    try {
      const response = await fetch('/api/webhooks/validate');
      const data = await response.json();
      setValidationStatus(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to validate webhooks:', error);
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const response = await fetch('/api/webhooks/update-workflows', {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Workflows aktualisiert',
          description: `${data.updated} Workflow(s) wurden erfolgreich aktualisiert.`,
        });
        // Recheck validation
        await checkValidation();
      } else {
        toast({
          title: 'Fehler',
          description: 'Workflows konnten nicht aktualisiert werden',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Workflows konnten nicht aktualisiert werden',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading || !validationStatus) {
    return null;
  }

  // Only show warning if validation failed
  if (validationStatus.valid) {
    return null;
  }

  const invalidWorkflows = validationStatus.workflows.filter(
    w => w.hasWebhook && !w.apiKeyMatch
  );

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-yellow-50 dark:bg-[hsl(45,40%,15%)] border border-yellow-200 dark:border-[hsl(45,40%,25%)] rounded-md">
      <FontAwesomeIcon
        icon={faExclamationTriangle}
        className="text-yellow-600 dark:text-yellow-400"
      />
      <div className="flex flex-col">
        <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
          Webhook API Key veraltet
        </span>
        <span className="text-xs text-yellow-600 dark:text-yellow-400">
          {invalidWorkflows.length} Workflow(s) müssen aktualisiert werden
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleUpdate}
        disabled={updating}
        className="h-7 text-xs"
      >
        <FontAwesomeIcon
          icon={updating ? faSpinner : faSync}
          spin={updating}
          className="mr-1"
        />
        Aktualisieren
      </Button>
    </div>
  );
}
