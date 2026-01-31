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
      }
    },
    required: ["title", "tags"]
  };

  // Add custom fields to schema (always include action_description and due_date, others only if enabled)
  if (customFields.length > 0) {
    const filteredFields = customFields.filter(field => {
      const isActionField = field.name === fieldActionDescription || field.name === fieldDueDate;
      return isActionField || fillCustomFields;
    });

    if (filteredFields.length > 0) {
      schema.properties.custom_fields = {
        type: "OBJECT",
        properties: {},
        description: "Custom field values",
        nullable: true
      };

      filteredFields.forEach(field => {
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
    }
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
  };

  // Add custom fields (always include action_description and due_date, others only if enabled)
  if (customFields.length > 0) {
    structure.custom_fields = {};
    customFields.forEach(field => {
      // Always include action tracking fields, or include all if custom fields are enabled
      const isActionField = field.name === fieldActionDescription || field.name === fieldDueDate;
      if (!isActionField && !fillCustomFields) {
        return; // Skip this field
      }

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

  const jsonStructure = JSON.stringify(structure, null, 2);

  // Build prompt
  let prompt = `You are a document analysis AI. Analyze the provided document and extract metadata in the following JSON format:\n\n`;
  prompt += jsonStructure;
  prompt += '\n\n';

  // Language instruction
  prompt += `**IMPORTANT - Response Language:**\n`;
  prompt += `- All text fields in your JSON response (title, tags, correspondent, document_type, storage_path, custom field values) MUST be in ${languageName}\n`;
  prompt += `- Use ${languageName} for all generated text, descriptions, and metadata\n\n`;

  // Get AI_TODO tag name from config to exclude it
  const tagAiTodoName = await getConfig(CONFIG_KEYS.TAG_AI_TODO) || 'ai_todo';

  // Tag instructions based on mode
  prompt += '**Tag Generation Rules:**\n';
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
  prompt += `- **NEVER include the tag "${tagAiTodoName}" in your response** - it is a system tag\n`;
  prompt += '\n';

  // Correspondents (only show list if strict mode is enabled)
  if (strictCorrespondents && correspondents.length > 0) {
    prompt += `**Available Correspondents (you MUST choose one from this list or use null):** [${correspondents.map(c => c.name).join(', ')}]\n`;
    prompt += '- Do NOT create new correspondents\n';
    prompt += '\n';
  }

  // Document Types (only show list if strict mode is enabled)
  if (strictDocumentTypes && documentTypes.length > 0) {
    prompt += `**Available Document Types (you MUST choose one from this list or use null):** [${documentTypes.map(t => t.name).join(', ')}]\n`;
    prompt += '- Do NOT create new document types\n';
    prompt += '\n';
  }

  // Storage Paths (only show list if strict mode is enabled)
  if (strictStoragePaths && storagePaths.length > 0) {
    prompt += `**Available Storage Paths (you MUST choose one from this list or use null):** [${storagePaths.map(p => p.name).join(', ')}]\n`;
    prompt += '- Do NOT create new storage paths\n';
    prompt += '\n';
  }

  // Custom fields instruction (only if auto-fill is enabled)
  if (fillCustomFields && customFields.length > 0) {
    const nonActionFields = customFields.filter(field =>
      field.name !== fieldActionDescription && field.name !== fieldDueDate
    );

    if (nonActionFields.length > 0) {
      prompt += '**Custom Fields - Auto-Fill Enabled:**\n';
      prompt += '- You should fill as many custom fields as possible based on the document content\n';
      prompt += '- Available custom fields:\n';
      nonActionFields.forEach(field => {
        let typeInfo = field.data_type;
        if (field.data_type === 'date') {
          typeInfo = 'date (YYYY-MM-DD format)';
        } else if (field.data_type === 'select' && field.extra_data?.select_options) {
          const options = field.extra_data.select_options;
          typeInfo = `select (options: ${options.join(', ')})`;
        }
        prompt += `  • ${field.name} (${typeInfo}): Extract relevant information from the document\n`;
      });
      prompt += '- Leave fields empty (null) if no relevant information is found in the document\n';
      prompt += '\n';
    }
  }

  // Action description field instruction
  prompt += '**Action Detection - CRITICAL:**\n';
  prompt += `- Carefully analyze if the document requires MANDATORY user action with deadlines or consequences\n`;
  prompt += `- If action is required, you MUST fill the custom field "${fieldActionDescription}" with a SHORT description\n`;
  prompt += '\n';
  prompt += '**Examples of MANDATORY actions that require the action field:**\n';
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
  prompt += '**Action description format:**\n';
  prompt += `  • Keep it SHORT and actionable (max 100 characters)\n`;
  prompt += `  • Examples: "Pay invoice by 2024-03-15", "Cancel before renewal on 2024-04-01", "Submit application by 2024-05-10"\n`;
  prompt += '\n';
  prompt += '**Due date field:**\n';
  prompt += `  • If there is a specific deadline, set the custom field "${fieldDueDate}" with the date in YYYY-MM-DD format\n`;
  prompt += `  • Extract the date from the document (payment due date, cancellation deadline, response deadline, etc.)\n\n`;

  // Add custom prompt
  if (customPrompt.trim()) {
    prompt += '**Additional Instructions:**\n';
    prompt += customPrompt.trim();
    prompt += '\n\n';
  }

  prompt += '**Final Instructions:**\n';
  prompt += '- Your response MUST be valid JSON only\n';
  prompt += '- Do NOT include markdown code blocks (```json), explanations, or any text outside the JSON\n';
  prompt += '- Do NOT truncate the JSON - ensure it is complete and valid\n';
  prompt += '- Ensure all text is in the specified language\n';
  prompt += '- All fields are optional except "title" and "tags"\n';
  if (fillCustomFields) {
    prompt += '- Fill custom_fields where relevant information is available in the document\n';
  }
  prompt += `- ALWAYS fill "${fieldActionDescription}" and "${fieldDueDate}" if action is detected\n`;
  prompt += '\n';

  prompt += '**Document to analyze:**\n\n';
  prompt += documentContent;

  // Generate response schema for strict validation
  const schema = await generateResponseSchema(paperlessClient, fillCustomFields, fieldActionDescription, fieldDueDate);

  return { prompt, schema };
}
