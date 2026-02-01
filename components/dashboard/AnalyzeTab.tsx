"use client"

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBrain, faSpinner, faSave, faCode, faListCheck, faPlus, faTag, faRefresh, faFileLines, faCopy, faPlay } from '@fortawesome/free-solid-svg-icons';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';


interface PaperlessMetadata {
  tags: Array<{ id: number; name: string }>;
  correspondents: Array<{ id: number; name: string }>;
  documentTypes: Array<{ id: number; name: string }>;
  customFields: Array<{ id: number; name: string; data_type: string }>;
  storagePaths: Array<{ id: number; name: string }>;
}

type TagMode = 'strict' | 'flexible' | 'free';

export default function AnalyzeTab() {
  const t = useTranslations('dashboard');

  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPaperless, setSavingPaperless] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);
  const [creatingField, setCreatingField] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isProcessingLocked, setIsProcessingLocked] = useState(false);
  const [metadata, setMetadata] = useState<PaperlessMetadata | null>(null);

  // Config state
  const [tagAiTodo, setTagAiTodo] = useState('');
  const [tagActionRequired, setTagActionRequired] = useState('');
  const [fieldActionDescription, setFieldActionDescription] = useState('');
  const [fieldDueDate, setFieldDueDate] = useState('');
  const [tagMode, setTagMode] = useState<TagMode>('flexible');
  const [maxTags, setMaxTags] = useState('5');
  const [strictCorrespondents, setStrictCorrespondents] = useState(false);
  const [strictDocumentTypes, setStrictDocumentTypes] = useState(false);
  const [strictStoragePaths, setStrictStoragePaths] = useState(false);
  const [fillCustomFields, setFillCustomFields] = useState(true);
  const [customPrompt, setCustomPrompt] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [systemLanguage, setSystemLanguage] = useState('de');

  // New tag creation
  const [newTagName, setNewTagName] = useState('');

  // New custom field creation
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('string');

  // Load metadata and config
  useEffect(() => {
    loadData();
  }, []);

  // Check processing lock status periodically
  useEffect(() => {
    const checkLockStatus = async () => {
      try {
        const response = await fetch('/api/processing-status');
        const data = await response.json();
        const hasAiProcessing = data.activeProcesses?.some(
          (p: any) => p.type === 'AI_DOCUMENT_PROCESSING'
        );
        setIsProcessingLocked(hasAiProcessing || false);
      } catch (error) {
        console.error('Failed to check lock status:', error);
      }
    };

    checkLockStatus();
    const interval = setInterval(checkLockStatus, 3000);

    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load Paperless metadata
      const metadataRes = await fetch('/api/paperless/metadata');
      const metadataData = await metadataRes.json();
      setMetadata(metadataData);

      // Load saved config
      const config1Res = await fetch('/api/setup/load-config?step=6');
      const config1Data = await config1Res.json();

      const config2Res = await fetch('/api/setup/load-config?step=2');
      const config2Data = await config2Res.json();

      // Load system language
      const config0Res = await fetch('/api/setup/load-config?step=0');
      const config0Data = await config0Res.json();

      setTagAiTodo(config1Data.tagAiTodo || 'ai_todo');
      setTagActionRequired(config1Data.tagActionRequired || 'action_required');
      setFieldActionDescription(config1Data.fieldActionDescription || 'action_description');
      setFieldDueDate(config1Data.fieldDueDate || 'due_date');

      setCustomPrompt(config2Data.geminiPromptTemplate || '');
      setTagMode((config2Data.geminiTagMode || 'flexible') as TagMode);
      setMaxTags(config2Data.geminiMaxTags || '5');
      setStrictCorrespondents(config2Data.geminiStrictCorrespondents === 'true');
      setStrictDocumentTypes(config2Data.geminiStrictDocumentTypes === 'true');
      setStrictStoragePaths(config2Data.geminiStrictStoragePaths === 'true');
      setFillCustomFields(config2Data.geminiFillCustomFields !== 'false'); // Default true

      setSystemLanguage(config0Data.locale || 'de');
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: t('fehler'),
        description: t('daten_konnten_nicht_geladen_werden'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePaperless = async () => {
    setSavingPaperless(true);
    try {
      // Save paperless integration config (step 6)
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 6,
          data: {
            tagAiTodo,
            tagActionRequired,
            fieldActionDescription,
            fieldDueDate,
          },
        }),
      });

      toast({
        title: 'Gespeichert',
        description: t('paperless_integration_einstellungen_wurden_gespeic'),
      });
    } catch (error) {
      toast({
        title: t('fehler'),
        description: t('einstellungen_konnten_nicht_gespeichert_werden'),
        variant: 'destructive',
      });
    } finally {
      setSavingPaperless(false);
    }
  };

  const handleManualProcess = async () => {
    setProcessing(true);
    try {
      const response = await fetch('/api/process-ai-documents', {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Verarbeitung abgeschlossen',
          description: `${result.successful} von ${result.total} Dokumenten erfolgreich verarbeitet`,
        });
      } else {
        toast({
          title: t('fehler'),
          description: result.error || 'Verarbeitung fehlgeschlagen',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: t('fehler'),
        description: t('verarbeitung_konnte_nicht_gestartet_werden'),
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save gemini config (step 2)
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 2,
          data: {
            geminiPromptTemplate: customPrompt,
            geminiTagMode: tagMode,
            geminiMaxTags: maxTags,
            geminiStrictCorrespondents: strictCorrespondents ? 'true' : 'false',
            geminiStrictDocumentTypes: strictDocumentTypes ? 'true' : 'false',
            geminiStrictStoragePaths: strictStoragePaths ? 'true' : 'false',
            geminiFillCustomFields: fillCustomFields ? 'true' : 'false',
          },
        }),
      });

      toast({
        title: 'Gespeichert',
        description: t('ki_verhalten_einstellungen_wurden_gespeichert'),
      });
      setHasChanges(false);
    } catch (error) {
      toast({
        title: t('fehler'),
        description: t('einstellungen_konnten_nicht_gespeichert_werden'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const createTag = async () => {
    if (!newTagName.trim()) {
      toast({
        title: t('fehler'),
        description: 'Bitte Tag-Namen eingeben',
        variant: 'destructive',
      });
      return;
    }

    setCreatingTag(true);
    try {
      const response = await fetch('/api/paperless/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName }),
      });

      if (response.ok) {
        toast({
          title: t('tag_erstellt'),
          description: `Tag "${newTagName}" wurde in Paperless erstellt`,
        });
        setNewTagName('');
        // Reload metadata
        const metadataRes = await fetch('/api/paperless/metadata');
        const metadataData = await metadataRes.json();
        setMetadata(metadataData);
      } else {
        throw new Error('Tag creation failed');
      }
    } catch (error) {
      toast({
        title: t('fehler'),
        description: t('tag_konnte_nicht_erstellt_werden'),
        variant: 'destructive',
      });
    } finally {
      setCreatingTag(false);
    }
  };

  const createCustomField = async () => {
    if (!newFieldName.trim()) {
      toast({
        title: t('fehler'),
        description: 'Bitte Feld-Namen eingeben',
        variant: 'destructive',
      });
      return;
    }

    setCreatingField(true);
    try {
      const response = await fetch('/api/paperless/custom-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFieldName,
          data_type: newFieldType,
        }),
      });

      if (response.ok) {
        toast({
          title: t('feld_erstellt'),
          description: `Benutzerdefiniertes Feld "${newFieldName}" wurde erstellt`,
        });
        setNewFieldName('');
        setNewFieldType('string');
        // Reload metadata
        const metadataRes = await fetch('/api/paperless/metadata');
        const metadataData = await metadataRes.json();
        setMetadata(metadataData);
      } else {
        throw new Error('Field creation failed');
      }
    } catch (error) {
      toast({
        title: t('fehler'),
        description: t('feld_konnte_nicht_erstellt_werden'),
        variant: 'destructive',
      });
    } finally {
      setCreatingField(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          document.execCommand('copy');
          textArea.remove();
        } catch (err) {
          textArea.remove();
          throw err;
        }
      }

      toast({
        title: 'Kopiert',
        description: `${label} wurde in die Zwischenablage kopiert`,
      });
    } catch (error) {
      toast({
        title: t('fehler'),
        description: t('konnte_nicht_in_zwischenablage_kopieren_bitte_manu'),
        variant: 'destructive',
      });
      console.error('Clipboard error:', error);
    }
  };

  const refreshMetadata = async () => {
    try {
      const metadataRes = await fetch('/api/paperless/metadata');
      const metadataData = await metadataRes.json();
      setMetadata(metadataData);
      toast({
        title: 'Aktualisiert',
        description: 'Metadaten wurden neu geladen',
      });
    } catch (error) {
      toast({
        title: t('fehler'),
        description: t('konnte_metadaten_nicht_laden'),
        variant: 'destructive',
      });
    }
  };

  // Generate expected JSON structure
  const generateJSONStructure = () => {
    if (!metadata) return '{}';

    const structure: any = {
      title: "string (suggested document title)",
      tags: ["array", "of", "tag", "names"],
      correspondent: "correspondent name or null",
      document_type: "document type name or null",
      storage_path: "storage path name or null",
      created_date: "YYYY-MM-DD (document issue/creation date) or null",
      notes: "string (brief summary/notes about the document) or null",
    };

    // Add custom fields
    if (metadata.customFields.length > 0) {
      structure.custom_fields = {};
      metadata.customFields.forEach(field => {
        let displayValue: string;
        switch (field.data_type) {
          case 'date':
            displayValue = 'YYYY-MM-DD or null';
            break;
          case 'float':
            displayValue = '123.45 (number) or null';
            break;
          case 'integer':
            displayValue = '123 (integer) or null';
            break;
          case 'boolean':
            displayValue = 'true or false or null';
            break;
          case 'string':
          case 'text':
            displayValue = 'string value or null';
            break;
          case 'url':
            displayValue = 'https://example.com or null';
            break;
          case 'documentlink':
            displayValue = '123 (document ID) or null';
            break;
          case 'select':
            displayValue = 'option value or null';
            break;
          default:
            displayValue = 'string value or null';
        }
        structure.custom_fields[field.name] = displayValue;
      });
    }

    return JSON.stringify(structure, null, 2);
  };

  // Generate full prompt
  const generateFullPrompt = () => {
    if (!metadata) return '';

    const languageNames: Record<string, string> = {
      'de': 'German',
      'en': 'English',
    };
    const languageName = languageNames[systemLanguage] || 'German';

    let prompt = `You are a document analysis AI. Analyze the provided document and extract metadata in the following JSON format:\n\n`;
    prompt += generateJSONStructure();
    prompt += '\n\n';

    // Language instruction
    prompt += `**IMPORTANT - Language:**\n`;
    prompt += `- All text fields in your JSON response (title, tags, correspondent, document_type, storage_path, custom field values) MUST be in ${languageName}\n`;
    prompt += `- Use ${languageName} for all generated text, descriptions, and metadata\n\n`;

    // === STEP 1: Action Detection Logic (CRITICAL) ===
    prompt += '**STEP 1: Action Detection Logic (CRITICAL)**\n\n';
    prompt += 'First, analyze if the document requires MANDATORY user action with deadlines or consequences.\n\n';

    prompt += '**Examples of MANDATORY actions:**\n';
    prompt += '  • Payment deadlines (invoice must be paid by date, late fees apply)\n';
    prompt += '  • Cancellation deadlines (contract/subscription must be cancelled before renewal)\n';
    prompt += '  • Response deadlines (must respond to inquiry, appeal, or request by date)\n';
    prompt += '  • Appointment scheduling (must schedule appointment or confirm attendance)\n';
    prompt += '  • Document submission (forms, applications, documents must be submitted)\n';
    prompt += '  • Signature required (contract, agreement, form needs signature)\n';
    prompt += '  • Registration deadlines (must register for event, course, service)\n';
    prompt += '  • Renewal reminders (license, membership, subscription expiring)\n';
    prompt += '  • Compliance actions (regulatory requirements, tax filings, legal obligations)\n';
    prompt += '\n';

    prompt += '**IF action is detected, you MUST do ALL of the following:**\n';
    prompt += `  1. Add the tag "${tagActionRequired}" to the tags array\n`;
    prompt += `  2. Fill the custom field "${fieldActionDescription}" with a SHORT actionable description (max 100 characters)\n`;
    prompt += `     Examples: "Pay invoice by 2024-03-15", "Cancel before renewal on 2024-04-01"\n`;
    prompt += `  3. If there is a specific deadline, fill the custom field "${fieldDueDate}" with the date in YYYY-MM-DD format\n`;
    prompt += '\n';
    prompt += '**IF NO action is detected:**\n';
    prompt += `  - Do NOT add "${tagActionRequired}" to tags\n`;
    prompt += `  - Set custom_fields.${fieldActionDescription} to null\n`;
    prompt += `  - Set custom_fields.${fieldDueDate} to null\n`;
    prompt += '\n\n';

    // === STEP 2: Tag Generation ===
    prompt += '**STEP 2: Tag Generation**\n\n';
    prompt += 'Generate descriptive tags for the document.\n\n';

    if (tagMode === 'strict') {
      prompt += `- You MUST ONLY use tags from the following list (max ${maxTags} tags): [${metadata.tags.map(t => t.name).join(', ')}]\n`;
      prompt += '- Do NOT create new tags\n';
    } else if (tagMode === 'flexible') {
      prompt += `- You should prefer using existing tags from this list (max ${maxTags} tags): [${metadata.tags.map(t => t.name).join(', ')}]\n`;
      prompt += '- You MAY create new tags if existing ones do not fit well\n';
      prompt += '- Only create new tags when truly necessary\n';
    } else { // free
      prompt += `- You can create any tags that describe the document (max ${maxTags} tags)\n`;
    }
    prompt += `- IMPORTANT: If you detected an action in STEP 1, ensure "${tagActionRequired}" is included in the tags array\n`;
    prompt += '\n\n';

    // === STEP 3: Metadata & Custom Fields Extraction ===
    prompt += '**STEP 3: Metadata & Custom Fields Extraction**\n\n';
    prompt += 'Extract the following metadata from the document:\n\n';

    prompt += '**Title:**\n';
    prompt += '- Generate a descriptive document title\n';
    prompt += '\n';

    prompt += '**Correspondent:**\n';
    if (strictCorrespondents && metadata.correspondents.length > 0) {
      prompt += `- You MUST choose one from this list or use null: [${metadata.correspondents.map(c => c.name).join(', ')}]\n`;
      prompt += '- Do NOT create new correspondents\n';
    } else {
      prompt += '- Extract the sender/organization name from the document\n';
      prompt += '- If NOT found: Set to null\n';
    }
    prompt += '\n';

    prompt += '**Document Type:**\n';
    if (strictDocumentTypes && metadata.documentTypes.length > 0) {
      prompt += `- You MUST choose one from this list or use null: [${metadata.documentTypes.map(t => t.name).join(', ')}]\n`;
      prompt += '- Do NOT create new document types\n';
    } else {
      prompt += '- Determine the document type (invoice, contract, letter, etc.)\n';
      prompt += '- If NOT found: Set to null\n';
    }
    prompt += '\n';

    prompt += '**Storage Path:**\n';
    if (strictStoragePaths && metadata.storagePaths.length > 0) {
      prompt += `- You MUST choose one from this list or use null: [${metadata.storagePaths.map(p => p.name).join(', ')}]\n`;
      prompt += '- Do NOT create new storage paths\n';
    } else {
      prompt += '- Suggest an appropriate storage path if applicable\n';
      prompt += '- If NOT found: Set to null\n';
    }
    prompt += '\n';

    prompt += '**Document Date (created_date):**\n';
    prompt += '- Extract the document creation/issue date (Ausstellungsdatum, Rechnungsdatum, etc.)\n';
    prompt += '- Format: YYYY-MM-DD\n';
    prompt += '- Examples: Invoice date, contract date, letter date\n';
    prompt += '- If NOT found: Set to null\n';
    prompt += '\n';

    prompt += '**Notes:**\n';
    prompt += '- Generate a brief summary of the document content (2-3 sentences)\n';
    prompt += '- Include key information: amounts, dates, important details\n';
    prompt += '- Keep it concise and informative\n';
    prompt += '- If document is very simple: Set to null\n';
    prompt += '\n';

    prompt += '**Custom Fields:**\n';
    if (metadata.customFields.length > 0) {
      prompt += 'Extract information for the following custom fields:\n';
      metadata.customFields.forEach(field => {
        let typeInfo = field.data_type;
        if (field.data_type === 'date') {
          typeInfo = 'date (YYYY-MM-DD format)';
        } else if (field.data_type === 'float') {
          typeInfo = 'number (float)';
        }

        if (field.name === fieldActionDescription || field.name === fieldDueDate) {
          prompt += `  • ${field.name} (${typeInfo}): Filled in STEP 1 if action detected\n`;
        } else {
          prompt += `  • ${field.name} (${typeInfo}): Extract from document content\n`;
        }
      });
      prompt += '\n';
      if (fillCustomFields) {
        prompt += '**IMPORTANT for custom_fields:**\n';
        prompt += '- You MUST always return the complete custom_fields object with ALL fields\n';
        prompt += '- If data is NOT found: Set the value to null\n';
        prompt += '- Never omit fields from the response\n';
      } else {
        prompt += '**IMPORTANT for custom_fields:**\n';
        prompt += `- ONLY fill "${fieldActionDescription}" and "${fieldDueDate}" (if action detected in STEP 1)\n`;
        prompt += '- Set all other custom fields to null\n';
      }
    }
    prompt += '\n\n';

    // Add custom prompt
    if (customPrompt.trim()) {
      prompt += '**Additional Instructions:**\n';
      prompt += customPrompt.trim();
      prompt += '\n\n';
    }

    // === Final Response Rules ===
    prompt += '**Final Response Rules:**\n';
    prompt += '- Respond ONLY with valid JSON. Do not include any other text, markdown, or code blocks.\n';
    prompt += '- Ensure all text fields are in the specified language\n';
    prompt += '- Always return the complete JSON structure with all fields\n';
    prompt += '- Use null for missing or not-applicable values\n';
    prompt += '- Follow the exact JSON schema structure shown above\n';
    prompt += '\n\n';

    prompt += '**Document Content:**\n\n';
    prompt += '{{ DOCUMENT_CONTENT }}';

    return prompt;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FontAwesomeIcon icon={faBrain} className="text-blue-600" />
            AI Analyze Configuration
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Konfigurieren Sie, wie die KI Dokumente analysiert und Metadaten extrahiert
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData()}
          >
            <FontAwesomeIcon icon={faRefresh} className="mr-2" />
            Neu laden
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleManualProcess}
            disabled={processing || isProcessingLocked}
          >
            <FontAwesomeIcon icon={processing || isProcessingLocked ? faSpinner : faPlay} spin={processing || isProcessingLocked} className="mr-2" />
            {processing || isProcessingLocked ? 'Verarbeite...' : 'Jetzt verarbeiten'}
          </Button>
        </div>
      </div>

      {/* Manual Processing Info */}
      <Card className="bg-blue-50 dark:bg-[hsl(0,0%,15%)] border-blue-200 dark:border-[hsl(0,0%,25%)]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FontAwesomeIcon icon={faPlay} className="text-blue-600" />
            Manuelle Verarbeitung
          </CardTitle>
          <CardDescription>
            Verarbeiten Sie sofort alle Dokumente mit dem Tag "{tagAiTodo || 'ai_todo'}"
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Dieser Button triggert die AI-Analyse für alle Dokumente in Paperless, die das Tag "{tagAiTodo || 'ai_todo'}" haben.
            Dies ist nützlich zum Testen oder wenn Webhooks/Polling nicht funktionieren.
          </p>
          <Button
            onClick={handleManualProcess}
            disabled={processing || isProcessingLocked}
            className="w-full"
          >
            <FontAwesomeIcon icon={processing || isProcessingLocked ? faSpinner : faPlay} spin={processing || isProcessingLocked} className="mr-2" />
            {processing || isProcessingLocked ? 'Verarbeite Dokumente...' : 'AI-Analyse jetzt starten'}
          </Button>
          {isProcessingLocked && !processing && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              ⚠️ Eine AI-Verarbeitung läuft bereits. Bitte warten Sie, bis diese abgeschlossen ist.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Paperless Integration Config */}
      <Card>
        <CardHeader>
          <CardTitle>Paperless Integration</CardTitle>
          <CardDescription>
            Wählen Sie die Tags und Felder aus, die für die Verarbeitung verwendet werden
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tag AI Todo */}
            <div className="space-y-2">
              <Label htmlFor="tag-ai-todo">{t('tag_fuer_ai_todo')}</Label>
              <Select
                value={tagAiTodo}
                onValueChange={(value) => {
                  setTagAiTodo(value);
                  setHasChanges(true);
                }}
              >
                <SelectTrigger id="tag-ai-todo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {metadata?.tags.map(tag => (
                    <SelectItem key={tag.id} value={tag.name}>
                      {tag.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Dokumente mit diesem Tag werden von der KI analysiert
              </p>
            </div>

            {/* Tag Action Required */}
            <div className="space-y-2">
              <Label htmlFor="tag-action-required">{t('tag_fuer_action_required')}</Label>
              <Select
                value={tagActionRequired}
                onValueChange={(value) => {
                  setTagActionRequired(value);
                  setHasChanges(true);
                }}
              >
                <SelectTrigger id="tag-action-required">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {metadata?.tags.map(tag => (
                    <SelectItem key={tag.id} value={tag.name}>
                      {tag.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Dokumente mit erkannten Aktionen erhalten diesen Tag
              </p>
            </div>

            {/* Field Action Description */}
            <div className="space-y-2">
              <Label htmlFor="field-action-desc">{t('feld_fuer_aktionsbeschreibung')}</Label>
              <Select
                value={fieldActionDescription}
                onValueChange={(value) => {
                  setFieldActionDescription(value);
                  setHasChanges(true);
                }}
              >
                <SelectTrigger id="field-action-desc">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {metadata?.customFields.map(field => (
                    <SelectItem key={field.id} value={field.name}>
                      {field.name} ({field.data_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Beschreibung der erforderlichen Aktion
              </p>
            </div>

            {/* Field Due Date */}
            <div className="space-y-2">
              <Label htmlFor="field-due-date">{t('feld_fuer_faelligkeitsdatum')}</Label>
              <Select
                value={fieldDueDate}
                onValueChange={(value) => {
                  setFieldDueDate(value);
                  setHasChanges(true);
                }}
              >
                <SelectTrigger id="field-due-date">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {metadata?.customFields.map(field => (
                    <SelectItem key={field.id} value={field.name}>
                      {field.name} ({field.data_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Datum bis wann die Aktion erledigt sein muss
              </p>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleSavePaperless}
              disabled={savingPaperless}
            >
              {savingPaperless ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                  Speichern...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faSave} className="mr-2" />
                  Speichern
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tag Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FontAwesomeIcon icon={faTag} />
            Tag-Verwaltung
          </CardTitle>
          <CardDescription>
            Neue Tags in Paperless erstellen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Neuer Tag-Name..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  createTag();
                }
              }}
            />
            <Button
              onClick={createTag}
              disabled={creatingTag || !newTagName.trim()}
            >
              {creatingTag ? (
                <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
              ) : (
                <FontAwesomeIcon icon={faPlus} className="mr-2" />
              )}
              Erstellen
            </Button>
            <Button
              variant="outline"
              onClick={refreshMetadata}
            >
              <FontAwesomeIcon icon={faRefresh} className="mr-2" />
              Neu laden
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Custom Field Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FontAwesomeIcon icon={faFileLines} />
            Benutzerdefinierte Felder Verwaltung
          </CardTitle>
          <CardDescription>
            Neue benutzerdefinierte Felder in Paperless erstellen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Feld-Name..."
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              className="flex-1"
            />
            <Select value={newFieldType} onValueChange={setNewFieldType}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="string">String</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="integer">Integer</SelectItem>
                <SelectItem value="float">Float</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="url">URL</SelectItem>
                <SelectItem value="select">Select</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={createCustomField}
              disabled={creatingField || !newFieldName.trim()}
            >
              {creatingField ? (
                <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
              ) : (
                <FontAwesomeIcon icon={faPlus} className="mr-2" />
              )}
              Erstellen
            </Button>
            <Button
              variant="outline"
              onClick={refreshMetadata}
            >
              <FontAwesomeIcon icon={faRefresh} className="mr-2" />
              Neu laden
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Custom Fields Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FontAwesomeIcon icon={faListCheck} />
            Benutzerdefinierte Felder in Paperless
          </CardTitle>
          <CardDescription>
            Diese Felder können von der KI befüllt werden
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metadata && metadata.customFields.length > 0 ? (
            <div className="space-y-2">
              {metadata.customFields.map(field => (
                <div key={field.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">{field.name}</span>
                  <span className="text-sm px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">
                    {field.data_type}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Keine benutzerdefinierten Felder gefunden. Erstellen Sie welche oben.
            </p>
          )}

          {/* Refresh Button */}
          <div className="flex justify-end pt-4 border-t mt-4">
            <Button
              variant="outline"
              onClick={refreshMetadata}
            >
              <FontAwesomeIcon icon={faRefresh} className="mr-2" />
              Neu laden
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* JSON Structure */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FontAwesomeIcon icon={faCode} />
            Erwartete JSON-Struktur
          </CardTitle>
          <CardDescription>
            Diese Struktur wird automatisch generiert und an die KI übermittelt
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={generateJSONStructure()}
            readOnly
            className="font-mono text-xs h-64 bg-gray-50 dark:bg-gray-900"
          />

          {/* Copy Button */}
          <div className="flex justify-end pt-4 border-t mt-4">
            <Button
              variant="outline"
              onClick={() => copyToClipboard(generateJSONStructure(), 'JSON-Struktur')}
            >
              <FontAwesomeIcon icon={faCopy} className="mr-2" />
              Kopieren
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI Settings */}
      <Card>
        <CardHeader>
          <CardTitle>KI-Verhalten</CardTitle>
          <CardDescription>
            Konfigurieren Sie, wie strikt die KI sich an vorhandene Werte halten soll
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tag Mode */}
          <div className="space-y-2">
            <Label htmlFor="tag-mode">Tag-Generierungsmodus</Label>
            <Select
              value={tagMode}
              onValueChange={(value: TagMode) => {
                setTagMode(value);
                setHasChanges(true);
              }}
            >
              <SelectTrigger id="tag-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="strict">
                  Strikt - Nur vorhandene Tags verwenden
                </SelectItem>
                <SelectItem value="flexible">
                  Flexibel - Vorhandene bevorzugen, neue wo sinnvoll
                </SelectItem>
                <SelectItem value="free">
                  Frei - Beliebige Tags erstellen
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {tagMode === 'strict' && 'KI darf nur aus vorhandenen Tags wählen'}
              {tagMode === 'flexible' && 'KI bevorzugt vorhandene Tags, erstellt neue nur wenn nötig'}
              {tagMode === 'free' && 'KI erstellt beliebige Tags basierend auf Dokumentinhalt'}
            </p>
          </div>

          {/* Max Tags */}
          <div className="space-y-2">
            <Label htmlFor="max-tags">Maximale Anzahl Tags</Label>
            <Input
              id="max-tags"
              type="number"
              min="1"
              max="20"
              value={maxTags}
              onChange={(e) => {
                setMaxTags(e.target.value);
                setHasChanges(true);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Die KI darf maximal diese Anzahl Tags pro Dokument vergeben
            </p>
          </div>

          {/* Strict Correspondents */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="strict-correspondents">
                Nur vorhandene Korrespondenten verwenden
              </Label>
              <p className="text-sm text-muted-foreground">
                KI darf nur aus existierenden Korrespondenten wählen
              </p>
            </div>
            <Switch
              id="strict-correspondents"
              checked={strictCorrespondents}
              onCheckedChange={(checked) => {
                setStrictCorrespondents(checked);
                setHasChanges(true);
              }}
            />
          </div>

          {/* Strict Document Types */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="strict-document-types">
                Nur vorhandene Dokumententypen verwenden
              </Label>
              <p className="text-sm text-muted-foreground">
                KI darf nur aus existierenden Dokumententypen wählen
              </p>
            </div>
            <Switch
              id="strict-document-types"
              checked={strictDocumentTypes}
              onCheckedChange={(checked) => {
                setStrictDocumentTypes(checked);
                setHasChanges(true);
              }}
            />
          </div>

          {/* Strict Storage Paths */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="strict-storage-paths">
                Nur vorhandene Storage Paths verwenden
              </Label>
              <p className="text-sm text-muted-foreground">
                KI darf nur aus existierenden Storage Paths wählen
              </p>
            </div>
            <Switch
              id="strict-storage-paths"
              checked={strictStoragePaths}
              onCheckedChange={(checked) => {
                setStrictStoragePaths(checked);
                setHasChanges(true);
              }}
            />
          </div>

          {/* Fill Custom Fields */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="fill-custom-fields">
                Benutzerdefinierte Felder automatisch ausfüllen
              </Label>
              <p className="text-sm text-muted-foreground">
                KI füllt alle benutzerdefinierten Felder nach bestem Ermessen aus
              </p>
            </div>
            <Switch
              id="fill-custom-fields"
              checked={fillCustomFields}
              onCheckedChange={(checked) => {
                setFillCustomFields(checked);
                setHasChanges(true);
              }}
            />
          </div>

          {/* Custom Prompt */}
          <div className="space-y-2">
            <Label htmlFor="custom-prompt">
              Zusätzliche Anweisungen (Optional)
            </Label>
            <p className="text-sm text-muted-foreground">
              Fügen Sie spezifische Anweisungen für das Feintuning hinzu.
              Die grundlegenden Regeln werden automatisch generiert.
            </p>
            <Textarea
              id="custom-prompt"
              value={customPrompt}
              onChange={(e) => {
                setCustomPrompt(e.target.value);
                setHasChanges(true);
              }}
              placeholder={t('z_b_achte_besonders_auf_rechnungsnummern_und_faell')}
              className="h-32"
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
            >
              {saving ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                  Speichern...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faSave} className="mr-2" />
                  Speichern
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generated Prompt Preview */}
      <Card>
        <CardHeader>
          <CardTitle>{t('vollstaendiger_prompt_vorschau')}</CardTitle>
          <CardDescription>
            Dies ist der komplette Prompt, der an die KI gesendet wird (automatisch generiert).
            Listen werden nur hinzugefügt wenn die entsprechenden Strict-Modi aktiv sind.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={generateFullPrompt()}
            readOnly
            className="font-mono text-xs h-96 bg-gray-50 dark:bg-gray-900"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Prompt-Länge: {generateFullPrompt().length} Zeichen
          </p>

          {/* Copy Button */}
          <div className="flex justify-end pt-4 border-t mt-4">
            <Button
              variant="outline"
              onClick={() => copyToClipboard(generateFullPrompt(), 'Vollständiger Prompt')}
            >
              <FontAwesomeIcon icon={faCopy} className="mr-2" />
              Kopieren
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
