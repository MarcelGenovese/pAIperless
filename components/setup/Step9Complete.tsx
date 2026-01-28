"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import { useToast } from '@/hooks/use-toast';

interface Step9CompleteProps {
  data: Record<string, any>;
}

export default function Step9Complete({ data }: Step9CompleteProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [hasDocumentAI, setHasDocumentAI] = useState(false);
  const [hasOAuth, setHasOAuth] = useState(false);

  useEffect(() => {
    // Check Document AI config
    fetch('/api/setup/load-config?step=3')
      .then(res => res.json())
      .then(data => {
        if (data.projectId && data.processorId) {
          setHasDocumentAI(true);
        }
      })
      .catch(console.error);

    // Check OAuth config
    fetch('/api/setup/load-config?step=4')
      .then(res => res.json())
      .then(data => {
        if (data.clientId && data.clientSecret) {
          setHasOAuth(true);
        }
      })
      .catch(console.error);
  }, []);

  const handleComplete = async () => {
    try {
      // Mark setup as complete
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 9,
          data: {}
        })
      });

      toast({
        title: 'Setup Complete!',
        description: 'Redirecting to dashboard...',
        variant: 'success',
      });

      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to complete setup',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto text-center">
      <div className="mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
          <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-accent mb-2">
          Setup Complete!
        </h2>
        <p className="text-lg text-muted-foreground">
          Your pAIperless instance is now configured and ready to use.
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Configuration Summary</CardTitle>
        </CardHeader>
        <CardContent className="text-left space-y-3">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium">Paperless-NGX</span>
            <span className="text-sm text-green-600 flex items-center gap-1">
              <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />
              Connected
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium">Gemini AI</span>
            <span className="text-sm text-green-600 flex items-center gap-1">
              <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />
              Configured
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium">Document AI</span>
            {hasDocumentAI ? (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />
                Configured
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Pending</span>
            )}
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium">Google OAuth</span>
            {hasOAuth ? (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />
                Configured
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Pending</span>
            )}
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm font-medium">Worker Status</span>
            <span className="text-sm text-green-600 flex items-center gap-1">
              <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />
              Ready
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Button onClick={handleComplete} size="lg" className="w-full">
          Go to Dashboard
        </Button>

        <p className="text-sm text-muted-foreground">
          You can access settings anytime to modify your configuration
        </p>
      </div>

      <div className="mt-12 grid md:grid-cols-3 gap-6">
        <div className="text-center">
          <div className="text-3xl mb-2">📁</div>
          <h3 className="font-semibold mb-1">Drop Files</h3>
          <p className="text-sm text-muted-foreground">
            Place PDFs in the consume folder
          </p>
        </div>
        <div className="text-center">
          <div className="text-3xl mb-2">⚡</div>
          <h3 className="font-semibold mb-1">Auto-Process</h3>
          <p className="text-sm text-muted-foreground">
            OCR, tagging, and analysis automatically
          </p>
        </div>
        <div className="text-center">
          <div className="text-3xl mb-2">📊</div>
          <h3 className="font-semibold mb-1">Monitor</h3>
          <p className="text-sm text-muted-foreground">
            Track progress in the dashboard
          </p>
        </div>
      </div>
    </div>
  );
}
