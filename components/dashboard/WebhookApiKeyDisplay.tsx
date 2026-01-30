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

export default function WebhookApiKeyDisplay() {
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
      const response = await fetch('/api/webhook-api-key');
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
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);

      toast({
        title: 'In Zwischenablage kopiert',
        description: 'Webhook API Key wurde erfolgreich kopiert',
      });

      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast({
        title: 'Fehler',
        description: 'Konnte nicht in Zwischenablage kopieren',
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
      });

      const data = await response.json();

      if (data.success && data.apiKey) {
        setApiKey(data.apiKey);
        toast({
          title: 'API Key neu generiert',
          description: 'Der Webhook API Key wurde erfolgreich neu generiert. Bitte aktualisieren Sie die Paperless Workflows.',
        });
      } else {
        throw new Error('Failed to regenerate API key');
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'API Key konnte nicht neu generiert werden',
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
          className="relative flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md cursor-pointer transition-all hover:bg-blue-100 dark:hover:bg-blue-900"
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
            <AlertDialogDescription>
              Dies wird einen neuen Webhook API Key generieren. Der alte Key wird ungültig.
              <br /><br />
              <strong>Wichtig:</strong> Sie müssen den neuen Key in allen Paperless Workflows aktualisieren,
              sonst funktionieren die Webhooks nicht mehr.
            </AlertDialogDescription>
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
