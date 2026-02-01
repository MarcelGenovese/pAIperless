import { PaperlessClient } from './paperless';
import { getConfig, CONFIG_KEYS } from './config';

interface PromptConfig {
  tagMode: 'strict' | 'flexible' | 'free';
  maxTags: number;
  strictCorrespondents: boolean;
  strictDocumentTypes: boolean;
  strictStoragePaths: boolean;
  customPrompt?: string;
  fieldActionDescription: string;
  fieldDueDate: string;
  systemLanguage: string;
}

/**
 * Generate JSON schema for Gemini API response validation
 * Note: Gemini uses OpenAPI 3.0 schema format, not standard JSON Schema
 */
export async function generateResponseSchema(
  paperlessClient: PaperlessClient,
  fillCustomFields: boolean = true,
  fieldActionDescription?: string,
  fieldDueDate?: string
): Promise<any> {
  const customFields = await paperlessClient.getCustomFields();

  const schema: any = {
    type: "OBJECT",
    properties: {
      title: {
        type: "STRING",
        description: "Suggested document title",
        nullable: false
      },
      tags: {
        type: "ARRAY",
        items: { type: "STRING" },
        description: "Array of tag names",
        nullable: false
      },
      correspondent: {
        type: "STRING",
        description: "Correspondent name",
        nullable: true
      },
      document_type: {
        type: "STRING",
        description: "Document type name",
        nullable: true
      },
      storage_path: {
        type: "STRING",
        description: "Storage path name",
        nullable: true
      },
      created_date: {
        type: "STRING",
        format: "date",
        description: "Document date (creation/issue date) in YYYY-MM-DD format - use null if not found",
        nullable: true
      },
      notes: {
        type: "STRING",
        description: "Brief summary or important notes about the document content - use null if not applicable",
        nullable: true
      }
    },
    required: ["title", "tags", "created_date", "notes"]  // These fields must always be present (can be null)
  };

  // Add custom fields to schema - ALWAYS include ALL fields so AI knows they exist
  // (Schema must match the JSON structure shown in the prompt!)
  if (customFields.length > 0) {
    schema.properties.custom_fields = {
      type: "OBJECT",
      properties: {},
      description: "Custom field values - MUST ALWAYS be included with all fields",
      nullable: false  // CRITICAL: custom_fields object itself must always be present
    };

    customFields.forEach(field => {
      let fieldSchema: any = { nullable: true };

      switch (field.data_type) {
        case 'string':
        case 'text':
        case 'url':
        case 'select':
          fieldSchema.type = "STRING";
          break;
        case 'integer':
        case 'documentlink':
          fieldSchema.type = "INTEGER";
          break;
        case 'float':
          fieldSchema.type = "NUMBER";
          break;
        case 'boolean':
          fieldSchema.type = "BOOLEAN";
          break;
        case 'date':
          fieldSchema.type = "STRING";
          fieldSchema.format = "date";
          fieldSchema.description = "Date in YYYY-MM-DD format";
          break;
        default:
          fieldSchema.type = "STRING";
      }

      schema.properties.custom_fields.properties[field.name] = fieldSchema;
    });

    // Add custom_fields to required array if we have any fields
    schema.required.push("custom_fields");
  }

  return schema;
}

export async function generateAnalysisPrompt(
  paperlessClient: PaperlessClient,
  documentContent: string
): Promise<{ prompt: string; schema: any }> {
  // Load configuration
  const tagMode = (await getConfig(CONFIG_KEYS.GEMINI_TAG_MODE) || 'flexible') as 'strict' | 'flexible' | 'free';
  const maxTags = parseInt(await getConfig(CONFIG_KEYS.GEMINI_MAX_TAGS) || '5');
  const strictCorrespondents = (await getConfig(CONFIG_KEYS.GEMINI_STRICT_CORRESPONDENTS)) === 'true';
  const strictDocumentTypes = (await getConfig(CONFIG_KEYS.GEMINI_STRICT_DOCUMENT_TYPES)) === 'true';
  const strictStoragePaths = (await getConfig(CONFIG_KEYS.GEMINI_STRICT_STORAGE_PATHS)) === 'true';
  const fillCustomFields = (await getConfig(CONFIG_KEYS.GEMINI_FILL_CUSTOM_FIELDS)) === 'true';
  const customPrompt = await getConfig(CONFIG_KEYS.GEMINI_PROMPT_TEMPLATE) || '';
  const fieldActionDescription = await getConfig(CONFIG_KEYS.FIELD_ACTION_DESCRIPTION) || 'action_description';
  const fieldDueDate = await getConfig(CONFIG_KEYS.FIELD_DUE_DATE) || 'due_date';
  const systemLanguage = await getConfig(CONFIG_KEYS.SETUP_LOCALE) || 'de';

  // Load metadata from Paperless
  const [tags, correspondents, documentTypes, customFields, storagePaths] = await Promise.all([
    paperlessClient.getTags(),
    paperlessClient.getCorrespondents(),
    paperlessClient.getDocumentTypes(),
    paperlessClient.getCustomFields(),
    paperlessClient.getStoragePaths(),
  ]);

  const languageNames: Record<string, string> = {
    'de': 'German',
    'en': 'English',
  };
  const languageName = languageNames[systemLanguage] || 'German';

  // Generate JSON structure
  const structure: any = {
    title: "string (suggested document title)",
    tags: ["array", "of", "tag", "names"],
    correspondent: "correspondent name or null",
    document_type: "document type name or null",
    storage_path: "storage path name or null",
    created_date: "YYYY-MM-DD (document issue/creation date) or null",
    notes: "string (brief summary/notes about the document) or null",
  };

  // Add custom fields - ALWAYS show ALL fields in the structure so AI knows what's available
  if (customFields.length > 0) {
    structure.custom_fields = {};
    customFields.forEach(field => {
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

  const jsonStructure = JSON.stringify(structure, null, 2);

  // Build prompt with new optimized structure
  let prompt = `You are a document analysis AI. Analyze the provided document and extract metadata in the following JSON format:\n\n`;
  prompt += jsonStructure;
  prompt += '\n\n';

  // Language instruction
  prompt += `**IMPORTANT - Language:**\n`;
  prompt += `- All text fields in your JSON response (title, tags, correspondent, document_type, storage_path, custom field values) MUST be in ${languageName}\n`;
  prompt += `- Use ${languageName} for all generated text, descriptions, and metadata\n\n`;

  // Get AI_TODO and Action_Required tag names from config
  const tagAiTodoName = await getConfig(CONFIG_KEYS.TAG_AI_TODO) || 'ai_todo';
  const tagActionRequiredName = await getConfig(CONFIG_KEYS.TAG_ACTION_REQUIRED) || 'action_required';

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
  prompt += `  1. Add the tag "${tagActionRequiredName}" to the tags array\n`;
  prompt += `  2. Fill the custom field "${fieldActionDescription}" with a SHORT actionable description (max 100 characters)\n`;
  prompt += `     Examples: "Pay invoice by 2024-03-15", "Cancel before renewal on 2024-04-01"\n`;
  prompt += `  3. If there is a specific deadline, fill the custom field "${fieldDueDate}" with the date in YYYY-MM-DD format\n`;
  prompt += '\n';
  prompt += '**IF NO action is detected:**\n';
  prompt += `  - Do NOT add "${tagActionRequiredName}" to tags\n`;
  prompt += `  - Set custom_fields.${fieldActionDescription} to null\n`;
  prompt += `  - Set custom_fields.${fieldDueDate} to null\n`;
  prompt += '\n\n';

  // === STEP 2: Tag Generation ===
  prompt += '**STEP 2: Tag Generation**\n\n';
  prompt += 'Generate descriptive tags for the document.\n\n';

  if (tagMode === 'strict') {
    prompt += `- You MUST ONLY use tags from the following list (max ${maxTags} tags): [${tags.map(t => t.name).join(', ')}]\n`;
    prompt += '- Do NOT create new tags\n';
  } else if (tagMode === 'flexible') {
    prompt += `- You should prefer using existing tags from this list (max ${maxTags} tags): [${tags.map(t => t.name).join(', ')}]\n`;
    prompt += '- You MAY create new tags if existing ones do not fit well\n';
    prompt += '- Only create new tags when truly necessary\n';
  } else { // free
    prompt += `- You can create any tags that describe the document (max ${maxTags} tags)\n`;
  }
  prompt += `- IMPORTANT: If you detected an action in STEP 1, ensure "${tagActionRequiredName}" is included in the tags array\n`;
  prompt += '\n\n';

  // === STEP 3: Metadata & Custom Fields Extraction ===
  prompt += '**STEP 3: Metadata & Custom Fields Extraction**\n\n';
  prompt += 'Extract the following metadata from the document:\n\n';

  prompt += '**Title:**\n';
  prompt += '- Generate a descriptive document title\n';
  prompt += '\n';

  prompt += '**Correspondent:**\n';
  if (strictCorrespondents && correspondents.length > 0) {
    prompt += `- You MUST choose one from this list or use null: [${correspondents.map(c => c.name).join(', ')}]\n`;
    prompt += '- Do NOT create new correspondents\n';
  } else {
    prompt += '- Extract the sender/organization name from the document\n';
    prompt += '- If NOT found: Set to null\n';
  }
  prompt += '\n';

  prompt += '**Document Type:**\n';
  if (strictDocumentTypes && documentTypes.length > 0) {
    prompt += `- You MUST choose one from this list or use null: [${documentTypes.map(t => t.name).join(', ')}]\n`;
    prompt += '- Do NOT create new document types\n';
  } else {
    prompt += '- Determine the document type (invoice, contract, letter, etc.)\n';
    prompt += '- If NOT found: Set to null\n';
  }
  prompt += '\n';

  prompt += '**Storage Path:**\n';
  if (strictStoragePaths && storagePaths.length > 0) {
    prompt += `- You MUST choose one from this list or use null: [${storagePaths.map(p => p.name).join(', ')}]\n`;
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
  if (customFields.length > 0) {
    prompt += 'Extract information for the following custom fields:\n';
    customFields.forEach(field => {
      let typeInfo = field.data_type;
      if (field.data_type === 'date') {
        typeInfo = 'date (YYYY-MM-DD format)';
      } else if (field.data_type === 'select' && field.extra_data?.select_options) {
        const options = field.extra_data.select_options;
        typeInfo = `select (options: ${options.join(', ')})`;
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
  prompt += documentContent;

  // Generate response schema for strict validation
  const schema = await generateResponseSchema(paperlessClient, fillCustomFields, fieldActionDescription, fieldDueDate);

  return { prompt, schema };
}
