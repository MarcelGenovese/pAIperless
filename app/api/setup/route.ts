import { NextRequest, NextResponse } from 'next/server';
import { setConfig, setConfigSecure, CONFIG_KEYS } from '@/lib/config';
import { generateSecureToken } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const { step, data } = await request.json();

    switch (step) {
      case 0: // Welcome Screen
        await setConfig(CONFIG_KEYS.SETUP_LOCALE, data.locale || 'en');
        await setConfig(CONFIG_KEYS.BASE_URL, data.baseUrl);
        break;

      case 1: // Paperless
        if (data.paperlessUrl) {
          await setConfig(CONFIG_KEYS.PAPERLESS_URL, data.paperlessUrl);
        }
        if (data.paperlessToken) {
          await setConfigSecure(CONFIG_KEYS.PAPERLESS_TOKEN, data.paperlessToken);
        }

        // Generate webhook API key if requested
        if (data.generateWebhookKey) {
          console.log('Generating webhook API key...');
          const webhookKey = generateSecureToken(32);
          console.log('Generated webhook key:', webhookKey);
          await setConfig(CONFIG_KEYS.WEBHOOK_API_KEY, webhookKey);
          console.log('Webhook key saved to database');
          return NextResponse.json({ webhookApiKey: webhookKey });
        }
        break;

      case 2: // Gemini
        await setConfigSecure(CONFIG_KEYS.GEMINI_API_KEY, data.geminiApiKey);
        await setConfig(CONFIG_KEYS.GEMINI_MODEL, data.geminiModel);
        break;

      case 3: // Document AI
        await setConfig(CONFIG_KEYS.GOOGLE_CLOUD_PROJECT_ID, data.projectId);
        await setConfigSecure(CONFIG_KEYS.GOOGLE_CLOUD_CREDENTIALS, data.credentials);
        await setConfig(CONFIG_KEYS.DOCUMENT_AI_PROCESSOR_ID, data.processorId);
        await setConfig(CONFIG_KEYS.DOCUMENT_AI_LOCATION, data.location);
        break;

      case 4: // Google OAuth
        await setConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_CLIENT_ID, data.clientId);
        await setConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_CLIENT_SECRET, data.clientSecret);
        if (data.accessToken) {
          await setConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_ACCESS_TOKEN, data.accessToken);
        }
        if (data.refreshToken) {
          await setConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_REFRESH_TOKEN, data.refreshToken);
        }
        if (data.calendarId) {
          await setConfig(CONFIG_KEYS.GOOGLE_CALENDAR_ID, data.calendarId);
        }
        if (data.taskListId) {
          await setConfig(CONFIG_KEYS.GOOGLE_TASK_LIST_ID, data.taskListId);
        }
        break;

      case 5: // Email
        await setConfig(CONFIG_KEYS.EMAIL_ENABLED, data.enabled ? 'true' : 'false');
        if (data.enabled) {
          await setConfig(CONFIG_KEYS.SMTP_SERVER, data.smtpServer);
          await setConfig(CONFIG_KEYS.SMTP_PORT, data.smtpPort.toString());
          await setConfig(CONFIG_KEYS.SMTP_ENCRYPTION, data.smtpEncryption);
          await setConfig(CONFIG_KEYS.SMTP_USER, data.smtpUser);
          await setConfigSecure(CONFIG_KEYS.SMTP_PASSWORD, data.smtpPassword);
          await setConfig(CONFIG_KEYS.EMAIL_SENDER, data.emailSender);
          await setConfig(CONFIG_KEYS.EMAIL_RECIPIENTS, data.emailRecipients);
        }
        break;

      case 6: // Paperless Integration
        await setConfig(CONFIG_KEYS.TAG_AI_TODO, data.tagAiTodo);
        await setConfig(CONFIG_KEYS.TAG_ACTION_REQUIRED, data.tagActionRequired);
        await setConfig(CONFIG_KEYS.FIELD_ACTION_DESCRIPTION, data.fieldActionDescription);
        await setConfig(CONFIG_KEYS.FIELD_DUE_DATE, data.fieldDueDate);
        break;

      case 7: // Advanced Settings
        await setConfig(CONFIG_KEYS.POLL_CONSUME_ENABLED, data.pollConsumeEnabled ? 'true' : 'false');
        await setConfig(CONFIG_KEYS.POLL_CONSUME_INTERVAL, data.pollConsumeInterval?.toString() || '10');
        await setConfig(CONFIG_KEYS.POLL_ACTION_ENABLED, data.pollActionEnabled ? 'true' : 'false');
        await setConfig(CONFIG_KEYS.POLL_ACTION_INTERVAL, data.pollActionInterval?.toString() || '30');
        await setConfig(CONFIG_KEYS.POLL_AI_TODO_ENABLED, data.pollAiTodoEnabled ? 'true' : 'false');
        await setConfig(CONFIG_KEYS.POLL_AI_TODO_INTERVAL, data.pollAiTodoInterval?.toString() || '30');
        break;

      case 8: // FTP
        await setConfig(CONFIG_KEYS.FTP_ENABLED, data.enabled ? 'true' : 'false');
        if (data.enabled) {
          await setConfig(CONFIG_KEYS.FTP_USERNAME, data.ftpUsername);
          await setConfigSecure(CONFIG_KEYS.FTP_PASSWORD, data.ftpPassword);
          await setConfig(CONFIG_KEYS.FTP_PORT, data.ftpPort?.toString() || '21');
          await setConfig(CONFIG_KEYS.FTP_ENABLE_TLS, data.enableTls ? 'true' : 'false');
        }
        break;

      case 9: // Complete
        await setConfig(CONFIG_KEYS.SETUP_COMPLETED, 'true');
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid step' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Failed to save setup data' },
      { status: 500 }
    );
  }
}
