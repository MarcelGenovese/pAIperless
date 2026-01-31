"use client"

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faArrowRight, faEye, faEyeSlash, faCheckCircle, faTimesCircle, faCopy, faKey, faSpinner, faUpload, faFileText, faExternalLinkAlt, faCalendar, faListUl, faEnvelope, faServer, faCog } from '@fortawesome/free-solid-svg-icons';

interface StepProps {
  onNext: (data: Record<string, any>) => void;
  onBack: () => void;
  data: Record<string, any>;
}

export default function Step3DocumentAI({ onNext, onBack, data }: StepProps) {
  const { toast } = useToast();

  const [projectId, setProjectId] = useState(data.googleCloudProjectId || '');
  const [processorId, setProcessorId] = useState(data.documentAIProcessorId || '');
  const [location, setLocation] = useState(data.documentAILocation || 'eu');
  const [serviceAccountFile, setServiceAccountFile] = useState<File | null>(null);
  const [serviceAccountJson, setServiceAccountJson] = useState<string>(data.googleCloudCredentials || '');

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isTestingOCR, setIsTestingOCR] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [ocrResult, setOcrResult] = useState<string>('');

  const canProceed = projectId && processorId && location && serviceAccountJson &&
                     connectionStatus === 'success' && ocrStatus === 'success';

  const handleSkip = async () => {
    try {
      // Save as disabled
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 3,
          data: {
            projectId: '',
            credentials: '',
            processorId: '',
            location: 'us',
            enabled: 'false'
          }
        }),
      });

      toast({
        title: "Document AI übersprungen",
        description: "Sie können Document AI später in den Einstellungen konfigurieren.",
      });

      onNext({});
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Konfiguration konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast({
        title: "Invalid File",
        description: "Please upload a JSON file with your service account credentials.",
        variant: "destructive",
      });
      return;
    }

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // Validate structure
      if (!json.type || !json.project_id || !json.private_key || !json.client_email) {
        throw new Error('Invalid service account JSON structure');
      }

      setServiceAccountFile(file);
      setServiceAccountJson(text);

      // Auto-fill project ID if empty
      if (!projectId && json.project_id) {
        setProjectId(json.project_id);
      }

      // Reset statuses when credentials change
      setConnectionStatus('idle');
      setOcrStatus('idle');
      setOcrResult('');

      toast({
        title: "Service Account Loaded",
        description: `Successfully loaded credentials for ${json.client_email}`,
      });
    } catch (error) {
      toast({
        title: "Invalid JSON",
        description: "Failed to parse service account JSON. Please check the file format.",
        variant: "destructive",
      });
      setServiceAccountFile(null);
      setServiceAccountJson('');
    }
  };

  const handleTestConnection = async () => {
    if (!projectId || !processorId || !location || !serviceAccountJson) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields before testing.",
        variant: "destructive",
      });
      return;
    }

    console.log('Testing Document AI connection with:', {
      projectId,
      processorId,
      location,
      hasCredentials: !!serviceAccountJson,
      credentialsLength: serviceAccountJson.length
    });

    // Validate credentials before sending
    console.log('=== FRONTEND VALIDATION START ===');
    console.log('serviceAccountJson exists:', !!serviceAccountJson);
    console.log('serviceAccountJson length:', serviceAccountJson?.length || 0);
    console.log('serviceAccountJson first 100 chars:', serviceAccountJson?.substring(0, 100));

    if (!serviceAccountJson || serviceAccountJson.trim() === '') {
      console.error('ERROR: serviceAccountJson is empty!');
      toast({
        title: "Missing Credentials",
        description: "Please upload a Service Account JSON file first.",
        variant: "destructive",
      });
      return;
    }

    try {
      const credCheck = JSON.parse(serviceAccountJson);
      console.log('Credentials validation - has client_email:', !!credCheck.client_email);
      console.log('Credentials validation - client_email value:', credCheck.client_email);
      console.log('Credentials validation - has private_key:', !!credCheck.private_key);
      console.log('Credentials validation - type:', credCheck.type);
      console.log('Credentials validation - project_id:', credCheck.project_id);
      console.log('=== FRONTEND VALIDATION SUCCESS ===');
    } catch (e) {
      console.error('Failed to validate credentials JSON:', e);
      toast({
        title: "Invalid Credentials",
        description: "Service Account JSON is not valid JSON format.",
        variant: "destructive",
      });
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus('idle');

    try {
      const requestBody = {
        projectId,
        processorId,
        location,
        credentials: serviceAccountJson,
        testType: 'connection'
      };
      console.log('Sending request with body keys:', Object.keys(requestBody));
      console.log('Request body credentials length:', requestBody.credentials.length);

      const response = await fetch('/api/setup/test-document-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log('Document AI response status:', response.status);
      console.log('Document AI response headers:', response.headers.get('content-type'));

      const responseText = await response.text();
      console.log('Document AI raw response body:', responseText);

      let result;
      try {
        result = JSON.parse(responseText);
        console.log('Document AI parsed result:', result);
      } catch (e) {
        console.error('Failed to parse Document AI response:', e);
        result = { error: 'Invalid server response: ' + responseText };
      }

      if (response.ok) {
        setConnectionStatus('success');
        toast({
          title: "Connection Successful",
          description: "Successfully connected to Google Cloud Document AI.",
        });
      } else {
        setConnectionStatus('error');
        const errorMsg = result?.error || "Failed to connect to Document AI. Please check your credentials.";
        console.error('Document AI connection error - showing to user:', errorMsg);

        toast({
          title: "Connection Failed",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setConnectionStatus('error');
      console.error('Document AI connection exception:', error);
      toast({
        title: "Connection Error",
        description: error.message || "An error occurred while testing the connection.",
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleTestOCR = async () => {
    if (connectionStatus !== 'success') {
      toast({
        title: "Test Connection First",
        description: "Please test the connection before running OCR test.",
        variant: "destructive",
      });
      return;
    }

    console.log('Testing Document AI OCR...');

    setIsTestingOCR(true);
    setOcrStatus('idle');
    setOcrResult('');

    try {
      const response = await fetch('/api/setup/test-document-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          processorId,
          location,
          credentials: serviceAccountJson,
          testType: 'ocr'
        }),
      });

      console.log('Document AI OCR response status:', response.status);
      console.log('Document AI OCR response headers:', response.headers.get('content-type'));

      const responseText = await response.text();
      console.log('Document AI OCR raw response body (first 500 chars):', responseText.substring(0, 500));

      let result;
      try {
        result = JSON.parse(responseText);
        console.log('Document AI OCR parsed result:', result);
      } catch (e) {
        console.error('Failed to parse OCR response:', e);
        result = { error: 'Invalid server response: ' + responseText };
      }

      if (response.ok) {
        setOcrStatus('success');
        setOcrResult(result.text || '');

        // Save configuration
        await fetch('/api/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            step: 3,
            data: {
              projectId,
              credentials: serviceAccountJson,
              processorId,
              location,
            }
          }),
        });

        toast({
          title: "OCR Test Successful",
          description: `Successfully extracted ${result.text?.length || 0} characters from test.pdf.`,
        });
      } else {
        setOcrStatus('error');
        const errorMsg = result?.error || "Failed to process test PDF. Please check your configuration.";
        console.error('Document AI OCR error - showing to user:', errorMsg);

        toast({
          title: "OCR Test Failed",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setOcrStatus('error');
      console.error('Document AI OCR exception:', error);
      toast({
        title: "OCR Error",
        description: error.message || "An error occurred during OCR testing.",
        variant: "destructive",
      });
    } finally {
      setIsTestingOCR(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-accent mb-2">
            Step 3: Google Cloud Document AI
          </h2>
          <p className="text-muted-foreground">
            Configure Document AI for OCR processing of your documents.
          </p>
        </div>

        <div className="space-y-4">
          {/* Service Account Upload */}
          <div className="space-y-2">
            <Label htmlFor="serviceAccount">Service Account JSON</Label>
            <div className="flex gap-2">
              <Input
                id="serviceAccount"
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="flex-1"
              />
              {serviceAccountFile && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />
                  {serviceAccountFile.name}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Upload your Google Cloud service account JSON key file.
            </p>
          </div>

          {/* Project ID */}
          <div className="space-y-2">
            <Label htmlFor="projectId">Project ID</Label>
            <Input
              id="projectId"
              type="text"
              placeholder="my-project-123456"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setConnectionStatus('idle');
                setOcrStatus('idle');
              }}
            />
            <p className="text-xs text-muted-foreground">
              Your Google Cloud project ID.
            </p>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Processor Location</Label>
            <Select value={location} onValueChange={(value) => {
              setLocation(value);
              setConnectionStatus('idle');
              setOcrStatus('idle');
            }}>
              <SelectTrigger id="location">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="us">United States (us)</SelectItem>
                <SelectItem value="eu">Europe (eu)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The region where your Document AI processor is deployed.
            </p>
          </div>

          {/* Processor ID */}
          <div className="space-y-2">
            <Label htmlFor="processorId">Processor ID</Label>
            <Input
              id="processorId"
              type="text"
              placeholder="abc123def456"
              value={processorId}
              onChange={(e) => {
                setProcessorId(e.target.value);
                setConnectionStatus('idle');
                setOcrStatus('idle');
              }}
            />
            <p className="text-xs text-muted-foreground">
              The ID of your Document AI OCR processor (not the full resource name).
            </p>
          </div>

          {/* Test Connection Button */}
          <div className="flex gap-2">
            <Button
              onClick={handleTestConnection}
              disabled={!projectId || !processorId || !serviceAccountJson || isTestingConnection}
              variant="outline"
              className="flex-1"
            >
              <FontAwesomeIcon
                icon={isTestingConnection ? faSpinner : (connectionStatus === 'success' ? faCheckCircle : (connectionStatus === 'error' ? faTimesCircle : faCheckCircle))}
                className={`mr-2 ${isTestingConnection ? 'animate-spin' : ''} ${connectionStatus === 'success' && !isTestingConnection ? 'text-green-600' : ''} ${connectionStatus === 'error' && !isTestingConnection ? 'text-red-600' : ''}`}
              />
              Test Connection
            </Button>

            <Button
              onClick={handleTestOCR}
              disabled={connectionStatus !== 'success' || isTestingOCR}
              variant="outline"
              className="flex-1"
            >
              <FontAwesomeIcon
                icon={isTestingOCR ? faSpinner : (ocrStatus === 'success' ? faCheckCircle : (ocrStatus === 'error' ? faTimesCircle : faFileText))}
                className={`mr-2 ${isTestingOCR ? 'animate-spin' : ''} ${ocrStatus === 'success' && !isTestingOCR ? 'text-green-600' : ''} ${ocrStatus === 'error' && !isTestingOCR ? 'text-red-600' : ''}`}
              />
              Test OCR
            </Button>
          </div>

          {/* OCR Result Preview */}
          {ocrResult && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-2">
              <Label>OCR Test Result (first 500 characters):</Label>
              <div className="text-sm text-muted-foreground font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                {ocrResult.substring(0, 500)}
                {ocrResult.length > 500 && '...'}
              </div>
              <p className="text-xs text-muted-foreground">
                Total extracted: {ocrResult.length} characters
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-6">
          <Button onClick={onBack} variant="outline">
            <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
            Back
          </Button>

          <div className="flex gap-3">
            <Button onClick={handleSkip} variant="ghost">
              Skip (Optional)
            </Button>
            <Button onClick={() => onNext({})} disabled={!canProceed}>
              Next
              <FontAwesomeIcon icon={faArrowRight} className="ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
