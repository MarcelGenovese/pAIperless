import { NextResponse } from 'next/server';
import { getConfig, CONFIG_KEYS } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const config = {
      // Paperless Integration
      paperlessUrl: await getConfig(CONFIG_KEYS.PAPERLESS_URL) || '',
      tagAiTodo: await getConfig(CONFIG_KEYS.TAG_AI_TODO) || 'ai_todo',
      tagActionRequired: await getConfig(CONFIG_KEYS.TAG_ACTION_REQUIRED) || 'action_required',
      fieldActionDescription: await getConfig(CONFIG_KEYS.FIELD_ACTION_DESCRIPTION) || 'action_description',
      fieldDueDate: await getConfig(CONFIG_KEYS.FIELD_DUE_DATE) || 'due_date',

      // Document AI
      documentAIEnabled: (await getConfig(CONFIG_KEYS.DOCUMENT_AI_ENABLED)) === 'true',
      documentAIMaxPages: await getConfig(CONFIG_KEYS.DOCUMENT_AI_MAX_PAGES) || '15',
      documentAIMaxSizeMB: await getConfig(CONFIG_KEYS.DOCUMENT_AI_MAX_SIZE_MB) || '20',
      documentAILocation: await getConfig(CONFIG_KEYS.DOCUMENT_AI_LOCATION) || 'us',

      // Gemini
      geminiModel: await getConfig(CONFIG_KEYS.GEMINI_MODEL) || 'gemini-1.5-flash',
      geminiTagMode: await getConfig(CONFIG_KEYS.GEMINI_TAG_MODE) || 'flexible',
      geminiMaxTags: await getConfig(CONFIG_KEYS.GEMINI_MAX_TAGS) || '5',
      geminiPromptTemplate: await getConfig(CONFIG_KEYS.GEMINI_PROMPT_TEMPLATE) || '',
      geminiFillCustomFields: (await getConfig(CONFIG_KEYS.GEMINI_FILL_CUSTOM_FIELDS)) !== 'false',
      geminiStrictCorrespondents: (await getConfig(CONFIG_KEYS.GEMINI_STRICT_CORRESPONDENTS)) === 'true',
      geminiStrictDocumentTypes: (await getConfig(CONFIG_KEYS.GEMINI_STRICT_DOCUMENT_TYPES)) === 'true',
      geminiStrictStoragePaths: (await getConfig(CONFIG_KEYS.GEMINI_STRICT_STORAGE_PATHS)) === 'true',

      // Polling
      pollAiTodoEnabled: (await getConfig(CONFIG_KEYS.POLL_AI_TODO_ENABLED)) === 'true',
      pollAiTodoInterval: await getConfig(CONFIG_KEYS.POLL_AI_TODO_INTERVAL) || '30',
      pollActionEnabled: (await getConfig(CONFIG_KEYS.POLL_ACTION_ENABLED)) === 'true',
      pollActionInterval: await getConfig(CONFIG_KEYS.POLL_ACTION_INTERVAL) || '30',
    };

    return NextResponse.json(config);
  } catch (error: any) {
    console.error('Failed to load config:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
