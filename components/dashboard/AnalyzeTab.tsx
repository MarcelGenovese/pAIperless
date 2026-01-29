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
import { faBrain, faSpinner, faSave, faCode, faListCheck, faPlus, faTag, faRefresh, faFileLines } from '@fortawesome/free-solid-svg-icons';
import { useToast } from '@/hooks/use-toast';

interface PaperlessMetadata {
  tags: Array<{ id: number; name: string }>;
  correspondents: Array<{ id: number; name: string }>;
  documentTypes: Array<{ id: number; name: string }>;
  customFields: Array<{ id: number; name: string; data_type: string }>;
  storagePaths: Array<{ id: number; name: string }>;
}

type TagMode = 'strict' | 'flexible' | 'free';

export default function AnalyzeTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);
  const [creatingField, setCreatingField] = useState(false);
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
  const [customPrompt, setCustomPrompt] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // New tag creation
  const [newTagName, setNewTagName] = useState('');

  // New custom field creation
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('string');

  // Load metadata and config
  useEffect(() => {
    loadData();
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
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Fehler',
        description: 'Daten konnten nicht geladen werden',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
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
          },
        }),
      });

      toast({
        title: 'Gespeichert',
        description: 'Analyse-Einstellungen wurden gespeichert',
      });
      setHasChanges(false);
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Einstellungen konnten nicht gespeichert werden',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const createTag = async () => {
    if (!newTagName.trim()) {
      toast({
        title: 'Fehler',
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
          title: 'Tag erstellt',
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
        title: 'Fehler',
        description: 'Tag konnte nicht erstellt werden',
        variant: 'destructive',
      });
    } finally {
      setCreatingTag(false);
    }
  };

  const createCustomField = async () => {
    if (!newFieldName.trim()) {
      toast({
        title: 'Fehler',
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
          title: 'Feld erstellt',
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
        title: 'Fehler',
        description: 'Feld konnte nicht erstellt werden',
        variant: 'destructive',
      });
    } finally {
      setCreatingField(false);
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
    };

    // Add custom fields
    if (metadata.customFields.length > 0) {
      structure.custom_fields = {};
      metadata.customFields.forEach(field => {
        let exampleValue: any;
        switch (field.data_type) {
          case 'string':
          case 'text':
            exampleValue = 'string value';
            break;
          case 'integer':
            exampleValue = 123;
            break;
          case 'float':
            exampleValue = 123.45;
            break;
          case 'boolean':
            exampleValue = true;
            break;
          case 'date':
            exampleValue = 'YYYY-MM-DD';
            break;
          case 'url':
            exampleValue = 'https://example.com';
            break;
          case 'documentlink':
            exampleValue = 123;
            break;
          case 'select':
            exampleValue = 'option value';
            break;
          default:
            exampleValue = 'string value';
        }
        structure.custom_fields[field.name] = `${field.data_type}: ${JSON.stringify(exampleValue)}`;
      });
    }

    return JSON.stringify(structure, null, 2);
  };

  // Generate full prompt
  const generateFullPrompt = () => {
    if (!metadata) return '';

    let prompt = `You are a document analysis AI. Analyze the provided document and extract metadata in the following JSON format:\n\n`;
    prompt += generateJSONStructure();
    prompt += '\n\n';

    // Tag instructions based on mode
    prompt += '**Tag Generation Rules:**\n';
    if (tagMode === 'strict') {
      prompt += `- You MUST ONLY use tags from the following list (max ${maxTags} tags):\n`;
      metadata.tags.forEach(t => prompt += `  - ${t.name}\n`);
      prompt += '- Do NOT create new tags\n';
    } else if (tagMode === 'flexible') {
      prompt += `- You should prefer using existing tags from this list (max ${maxTags} tags):\n`;
      metadata.tags.forEach(t => prompt += `  - ${t.name}\n`);
      prompt += '- You MAY create new tags if existing ones do not fit well\n';
      prompt += '- Only create new tags when truly necessary\n';
    } else { // free
      prompt += `- You can create any tags that describe the document (max ${maxTags} tags)\n`;
    }
    prompt += '\n';

    // Correspondents (only show list if strict mode is enabled)
    if (strictCorrespondents && metadata.correspondents.length > 0) {
      prompt += '**Available Correspondents (you MUST choose one from this list or use null):**\n';
      metadata.correspondents.forEach(c => prompt += `- ${c.name}\n`);
      prompt += '- Do NOT create new correspondents\n';
      prompt += '\n';
    }

    // Document Types (only show list if strict mode is enabled)
    if (strictDocumentTypes && metadata.documentTypes.length > 0) {
      prompt += '**Available Document Types (you MUST choose one from this list or use null):**\n';
      metadata.documentTypes.forEach(t => prompt += `- ${t.name}\n`);
      prompt += '- Do NOT create new document types\n';
      prompt += '\n';
    }

    // Storage Paths (only show list if strict mode is enabled)
    if (strictStoragePaths && metadata.storagePaths.length > 0) {
      prompt += '**Available Storage Paths (you MUST choose one from this list or use null):**\n';
      metadata.storagePaths.forEach(p => prompt += `- ${p.name}\n`);
      prompt += '- Do NOT create new storage paths\n';
      prompt += '\n';
    }

    // Add custom prompt
    if (customPrompt.trim()) {
      prompt += '**Additional Instructions:**\n';
      prompt += customPrompt.trim();
      prompt += '\n\n';
    }

    prompt += 'Respond ONLY with valid JSON. Do not include any other text or markdown.';

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
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadData()}
        >
          <FontAwesomeIcon icon={faRefresh} className="mr-2" />
          Neu laden
        </Button>
      </div>

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
              <Label htmlFor="tag-ai-todo">Tag für "AI Todo"</Label>
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
              <Label htmlFor="tag-action-required">Tag für "Action Required"</Label>
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
              <Label htmlFor="field-action-desc">Feld für Aktionsbeschreibung</Label>
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
              <Label htmlFor="field-due-date">Feld für Fälligkeitsdatum</Label>
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
              placeholder="z.B.: Achte besonders auf Rechnungsnummern und Fälligkeitsdaten..."
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
          <CardTitle>Vollständiger Prompt (Vorschau)</CardTitle>
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
        </CardContent>
      </Card>
    </div>
  );
}
