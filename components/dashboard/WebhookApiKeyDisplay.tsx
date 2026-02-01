"use client"

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKey, faRotate, faSpinner, faCopy } from '@fortawesome/free-solid-svg-icons';
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

export default function WebhookApiKeyDisplay() {
  const t = useTranslations('dashboard');

  const { toast } = useToast();
  const [apiKey, setApiKey] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadApiKey();
  }, []);

  const loadApiKey = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/webhook-api-key', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.apiKey) {
        setApiKey(data.apiKey);
      }
    } catch (error) {
      console.error('Failed to load webhook API key:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMouseEnter = async () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleClick = async () => {
    // Copy to clipboard on click
    try {
      // Try modern Clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(apiKey);
      } else {
        // Fallback for browsers without Clipboard API or insecure contexts
        const textArea = document.createElement('textarea');
        textArea.value = apiKey;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (!successful) {
          throw new Error('execCommand failed');
        }
      }

      setCopied(true);

      toast({
        title: t('in_zwischenablage_kopiert'),
        description: t('webhook_api_key_wurde_erfolgreich_kopiert'),
      });

      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast({
        title: t('fehler'),
        description: t('konnte_nicht_in_zwischenablage_kopieren_bitte_manu'),
        variant: 'destructive',
      });
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setShowConfirm(false);

    try {
      const response = await fetch('/api/webhook-api-key/regenerate', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success && data.apiKey) {
        setApiKey(data.apiKey);

        // Show appropriate message based on workflow update result
        if (data.workflowUpdate?.success) {
          toast({
            title: 'API Key neu generiert',
            description: `Der Webhook API Key wurde erfolgreich neu generiert und in ${data.workflowUpdate.updated} Workflow(s) aktualisiert.`,
          });
        } else if (data.workflowUpdate?.error) {
          toast({
            title: 'API Key neu generiert',
            description: t('api_key_generiert_aber_workflows_konnten_nicht_aut'),
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'API Key neu generiert',
            description: t('der_webhook_api_key_wurde_erfolgreich_neu_generier'),
          });
        }
      } else {
        throw new Error('Failed to regenerate API key');
      }
    } catch (error) {
      toast({
        title: t('fehler'),
        description: t('api_key_konnte_nicht_neu_generiert_werden'),
        variant: 'destructive',
      });
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-md">
        <FontAwesomeIcon icon={faSpinner} spin className="text-gray-400" />
        <span className="text-xs text-gray-400">Loading...</span>
      </div>
    );
  }

  if (!apiKey) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* API Key Display */}
        <div
          className="relative flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-[hsl(0,0%,15%)] border border-blue-200 dark:border-[hsl(0,0%,25%)] rounded-md cursor-pointer transition-all hover:bg-blue-100 dark:hover:bg-[hsl(0,0%,18%)]"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          title="Klicken zum Kopieren in Zwischenablage"
        >
          <FontAwesomeIcon
            icon={copied ? faCopy : faKey}
            className={`text-xs ${copied ? 'text-green-600' : 'text-blue-600 dark:text-blue-400'}`}
          />
          <code
            className={`text-xs font-mono transition-all duration-200 ${
              isHovered ? 'blur-none' : 'blur-sm select-none'
            }`}
          >
            {apiKey}
          </code>
          {copied && (
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
              Kopiert!
            </span>
          )}
        </div>

        {/* Regenerate Button */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setShowConfirm(true)}
          disabled={regenerating}
          title="Webhook API Key neu generieren"
        >
          <FontAwesomeIcon
            icon={regenerating ? faSpinner : faRotate}
            spin={regenerating}
            className="text-xs"
          />
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Webhook API Key neu generieren?</AlertDialogTitle>
            <AlertDialogDescription>{t('dies_wird_einen_neuen_webhook_api_key_generieren_d')}<br /><br />
              <strong>Wichtig:</strong>{t('sie_muessen_den_neuen_key_in_allen_paperless_workf')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerate}>
              Ja, neu generieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
