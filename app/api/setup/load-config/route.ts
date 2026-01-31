import { NextRequest, NextResponse } from 'next/server';
import { getConfig, getConfigSecure, CONFIG_KEYS } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const step = searchParams.get('step');

    if (!step) {
      return NextResponse.json(
        { error: 'Step parameter required' },
        { status: 400 }
      );
    }

    const data: Record<string, any> = {};

    switch (parseInt(step, 10)) {
      case 0: // General Settings
        data.locale = await getConfig(CONFIG_KEYS.SETUP_LOCALE) || 'de';
        data.darkMode = await getConfig(CONFIG_KEYS.DARK_MODE) || 'false';
        break;

      case 1: // Paperless
        data.paperlessUrl = await getConfig(CONFIG_KEYS.PAPERLESS_URL) || '';
        data.paperlessToken = await getConfigSecure(CONFIG_KEYS.PAPERLESS_TOKEN) || '';
        break;

      case 2: // Gemini
        data.geminiApiKey = await getConfigSecure(CONFIG_KEYS.GEMINI_API_KEY) || '';
        data.geminiModel = await getConfig(CONFIG_KEYS.GEMINI_MODEL) || 'gemini-1.5-flash';
        data.geminiMonthlyTokenLimit = await getConfig(CONFIG_KEYS.GEMINI_MONTHLY_TOKEN_LIMIT) || '1000000';
        data.geminiCostAmount = await getConfig(CONFIG_KEYS.GEMINI_COST_AMOUNT) || '0.35';
        data.geminiTokenUnit = await getConfig(CONFIG_KEYS.GEMINI_TOKEN_UNIT) || '1000000';
        data.geminiPromptTemplate = await getConfig(CONFIG_KEYS.GEMINI_PROMPT_TEMPLATE) || '';
        data.geminiTagMode = await getConfig(CONFIG_KEYS.GEMINI_TAG_MODE) || 'flexible';
        data.geminiMaxTags = await getConfig(CONFIG_KEYS.GEMINI_MAX_TAGS) || '5';
        data.geminiStrictCorrespondents = await getConfig(CONFIG_KEYS.GEMINI_STRICT_CORRESPONDENTS) || 'false';
        data.geminiStrictDocumentTypes = await getConfig(CONFIG_KEYS.GEMINI_STRICT_DOCUMENT_TYPES) || 'false';
        data.geminiStrictStoragePaths = await getConfig(CONFIG_KEYS.GEMINI_STRICT_STORAGE_PATHS) || 'false';
        data.geminiFillCustomFields = await getConfig(CONFIG_KEYS.GEMINI_FILL_CUSTOM_FIELDS) || 'true';
        break;

      case 3: // Document AI
        data.projectId = await getConfig(CONFIG_KEYS.GOOGLE_CLOUD_PROJECT_ID) || '';
        data.credentials = await getConfigSecure(CONFIG_KEYS.GOOGLE_CLOUD_CREDENTIALS) || '';
        data.processorId = await getConfig(CONFIG_KEYS.DOCUMENT_AI_PROCESSOR_ID) || '';
        data.location = await getConfig(CONFIG_KEYS.DOCUMENT_AI_LOCATION) || 'us';
        data.maxPages = await getConfig(CONFIG_KEYS.DOCUMENT_AI_MAX_PAGES) || '15';
        data.maxSizeMB = await getConfig(CONFIG_KEYS.DOCUMENT_AI_MAX_SIZE_MB) || '20';
        data.documentAIMonthlyPageLimit = await getConfig(CONFIG_KEYS.DOCUMENT_AI_MONTHLY_PAGE_LIMIT) || '5000';
        data.enabled = await getConfig(CONFIG_KEYS.DOCUMENT_AI_ENABLED) || 'false';
        data.costAmount = await getConfig(CONFIG_KEYS.DOCUMENT_AI_COST_AMOUNT) || '1.50';
        data.pageUnit = await getConfig(CONFIG_KEYS.DOCUMENT_AI_PAGE_UNIT) || '1000';
        break;

      case 4: // Google OAuth
        data.clientId = await getConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_CLIENT_ID) || '';
        data.clientSecret = await getConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_CLIENT_SECRET) || '';
        data.calendarId = await getConfig(CONFIG_KEYS.GOOGLE_CALENDAR_ID) || '';
        data.taskListId = await getConfig(CONFIG_KEYS.GOOGLE_TASK_LIST_ID) || '';
        break;

      case 5: // Email
        const emailEnabled = await getConfig(CONFIG_KEYS.EMAIL_ENABLED) === 'true';
        data.emailEnabled = emailEnabled;
        data.smtpServer = await getConfig(CONFIG_KEYS.SMTP_SERVER) || '';
        data.smtpPort = await getConfig(CONFIG_KEYS.SMTP_PORT) || '587';
        data.smtpEncryption = await getConfig(CONFIG_KEYS.SMTP_ENCRYPTION) || 'STARTTLS';
        data.smtpUser = await getConfig(CONFIG_KEYS.SMTP_USER) || '';
        data.smtpPassword = await getConfigSecure(CONFIG_KEYS.SMTP_PASSWORD) || '';
        data.emailSender = await getConfig(CONFIG_KEYS.EMAIL_SENDER) || '';
        data.emailRecipients = await getConfig(CONFIG_KEYS.EMAIL_RECIPIENTS) || '';
        break;

      case 6: // Paperless Integration
        data.tagAiTodo = await getConfig(CONFIG_KEYS.TAG_AI_TODO) || 'ai_todo';
        data.tagActionRequired = await getConfig(CONFIG_KEYS.TAG_ACTION_REQUIRED) || 'action_required';
        data.fieldActionDescription = await getConfig(CONFIG_KEYS.FIELD_ACTION_DESCRIPTION) || 'action_description';
        data.fieldDueDate = await getConfig(CONFIG_KEYS.FIELD_DUE_DATE) || 'due_date';
        break;

      case 7: // Advanced Settings
        data.pollConsumeEnabled = await getConfig(CONFIG_KEYS.POLL_CONSUME_ENABLED) === 'true';
        data.pollConsumeInterval = await getConfig(CONFIG_KEYS.POLL_CONSUME_INTERVAL) || '10';
        data.pollActionEnabled = await getConfig(CONFIG_KEYS.POLL_ACTION_ENABLED) === 'true';
        data.pollActionInterval = await getConfig(CONFIG_KEYS.POLL_ACTION_INTERVAL) || '30';
        data.pollAiTodoEnabled = await getConfig(CONFIG_KEYS.POLL_AI_TODO_ENABLED) === 'true';
        data.pollAiTodoInterval = await getConfig(CONFIG_KEYS.POLL_AI_TODO_INTERVAL) || '30';
        break;

      case 8: // FTP
        const ftpEnabled = await getConfig(CONFIG_KEYS.FTP_ENABLED) === 'true';
        data.ftpEnabled = ftpEnabled;
        data.ftpUsername = await getConfig(CONFIG_KEYS.FTP_USERNAME) || 'paiperless';
        data.ftpPassword = await getConfigSecure(CONFIG_KEYS.FTP_PASSWORD) || '';
        data.ftpPort = await getConfig(CONFIG_KEYS.FTP_PORT) || '21';
        data.ftpEnableTls = await getConfig(CONFIG_KEYS.FTP_ENABLE_TLS) === 'true';
        data.ftpPasvUrl = await getConfig(CONFIG_KEYS.FTP_PASV_URL) || '';
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid step' },
          { status: 400 }
        );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Load config error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load config' },
      { status: 500 }
    );
  }
}
