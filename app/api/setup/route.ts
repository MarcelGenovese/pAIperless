import { NextRequest, NextResponse } from 'next/server';
import { setConfig, setConfigSecure, CONFIG_KEYS } from '@/lib/config';
import { generateSecureToken } from '@/lib/utils';
import serviceManager from '@/lib/services/service-manager';

export async function POST(request: NextRequest) {
  try {
    const { step, data } = await request.json();

    switch (step) {
      case 0: // Welcome Screen / General Settings
        if (data.locale !== undefined) {
          await setConfig(CONFIG_KEYS.SETUP_LOCALE, data.locale || 'en');
        }
        if (data.baseUrl !== undefined) {
          await setConfig(CONFIG_KEYS.BASE_URL, data.baseUrl);
        }
        if (data.darkMode !== undefined) {
          await setConfig(CONFIG_KEYS.DARK_MODE, data.darkMode);
        }
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
        if (data.geminiApiKey !== undefined) {
          await setConfigSecure(CONFIG_KEYS.GEMINI_API_KEY, data.geminiApiKey);
        }
        if (data.geminiModel !== undefined) {
          await setConfig(CONFIG_KEYS.GEMINI_MODEL, data.geminiModel);
        }
        if (data.geminiMonthlyTokenLimit !== undefined) {
          await setConfig(CONFIG_KEYS.GEMINI_MONTHLY_TOKEN_LIMIT, data.geminiMonthlyTokenLimit.toString());
        }
        if (data.geminiCostAmount !== undefined) {
          await setConfig(CONFIG_KEYS.GEMINI_COST_AMOUNT, data.geminiCostAmount.toString());
        }
        if (data.geminiTokenUnit !== undefined) {
          await setConfig(CONFIG_KEYS.GEMINI_TOKEN_UNIT, data.geminiTokenUnit.toString());
        }
        if (data.geminiPromptTemplate !== undefined) {
          await setConfig(CONFIG_KEYS.GEMINI_PROMPT_TEMPLATE, data.geminiPromptTemplate);
        }
        if (data.geminiTagMode !== undefined) {
          await setConfig(CONFIG_KEYS.GEMINI_TAG_MODE, data.geminiTagMode);
        }
        if (data.geminiMaxTags !== undefined) {
          await setConfig(CONFIG_KEYS.GEMINI_MAX_TAGS, data.geminiMaxTags.toString());
        }
        if (data.geminiStrictCorrespondents !== undefined) {
          await setConfig(CONFIG_KEYS.GEMINI_STRICT_CORRESPONDENTS, data.geminiStrictCorrespondents);
        }
        if (data.geminiStrictDocumentTypes !== undefined) {
          await setConfig(CONFIG_KEYS.GEMINI_STRICT_DOCUMENT_TYPES, data.geminiStrictDocumentTypes);
        }
        if (data.geminiStrictStoragePaths !== undefined) {
          await setConfig(CONFIG_KEYS.GEMINI_STRICT_STORAGE_PATHS, data.geminiStrictStoragePaths);
        }
        if (data.geminiFillCustomFields !== undefined) {
          await setConfig(CONFIG_KEYS.GEMINI_FILL_CUSTOM_FIELDS, data.geminiFillCustomFields);
        }
        break;

      case 3: // Document AI
        await setConfig(CONFIG_KEYS.GOOGLE_CLOUD_PROJECT_ID, data.projectId);
        await setConfigSecure(CONFIG_KEYS.GOOGLE_CLOUD_CREDENTIALS, data.credentials);
        await setConfig(CONFIG_KEYS.DOCUMENT_AI_PROCESSOR_ID, data.processorId);
        await setConfig(CONFIG_KEYS.DOCUMENT_AI_LOCATION, data.location);
        if (data.maxPages !== undefined) {
          await setConfig(CONFIG_KEYS.DOCUMENT_AI_MAX_PAGES, data.maxPages.toString());
        }
        if (data.maxSizeMB !== undefined) {
          await setConfig(CONFIG_KEYS.DOCUMENT_AI_MAX_SIZE_MB, data.maxSizeMB.toString());
        }
        if (data.monthlyPageLimit !== undefined) {
          await setConfig(CONFIG_KEYS.DOCUMENT_AI_MONTHLY_PAGE_LIMIT, data.monthlyPageLimit.toString());
        }
        if (data.costAmount !== undefined) {
          await setConfig(CONFIG_KEYS.DOCUMENT_AI_COST_AMOUNT, data.costAmount.toString());
        }
        if (data.pageUnit !== undefined) {
          await setConfig(CONFIG_KEYS.DOCUMENT_AI_PAGE_UNIT, data.pageUnit.toString());
        }
        if (data.enabled !== undefined) {
          await setConfig(CONFIG_KEYS.DOCUMENT_AI_ENABLED, data.enabled);
        }
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

          // Notification settings
          await setConfig(CONFIG_KEYS.EMAIL_NOTIFY_SUCCESS, data.notifySuccess ? 'true' : 'false');
          await setConfig(CONFIG_KEYS.EMAIL_NOTIFY_ERROR, data.notifyError ? 'true' : 'false');
          await setConfig(CONFIG_KEYS.EMAIL_NOTIFY_API_LIMIT, data.notifyApiLimit ? 'true' : 'false');
          await setConfig(CONFIG_KEYS.EMAIL_NOTIFY_API_WARNING, data.notifyApiWarning ? 'true' : 'false');
          await setConfig(CONFIG_KEYS.EMAIL_API_WARNING_THRESHOLD, data.apiWarningThreshold?.toString() || '80');
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
          await setConfig(CONFIG_KEYS.FTP_PASV_URL, data.ftpPasvUrl || '');

          // Start FTP server after configuration is saved
          console.log('[Setup] Starting FTP server...');
          try {
            const startResult = await serviceManager.restart('ftp');
            console.log('[Setup] FTP server start result:', startResult);
            return NextResponse.json({
              success: true,
              ftpStarted: startResult.success,
              ftpMessage: startResult.message
            });
          } catch (error: any) {
            console.error('[Setup] Failed to start FTP server:', error);
            return NextResponse.json({
              success: true,
              ftpStarted: false,
              ftpMessage: `Configuration saved but FTP server failed to start: ${error.message}`
            });
          }
        } else {
          // Stop FTP server if disabled
          console.log('[Setup] Stopping FTP server (disabled)...');
          try {
            await serviceManager.restart('ftp');
          } catch (error) {
            console.error('[Setup] Error stopping FTP server:', error);
          }
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
