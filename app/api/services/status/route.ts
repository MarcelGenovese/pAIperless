import { useTranslations } from 'next-intl';
import { NextResponse } from 'next/server';
import { getConfig, getConfigSecure, CONFIG_KEYS } from '@/lib/config';
import { PaperlessClient } from '@/lib/paperless';
import serviceManager from '@/lib/services/service-manager';

export const runtime = 'nodejs';

export async function GET() {
  const statuses: Record<string, any> = {};

  // Check Paperless-NGX
  try {
    const paperlessUrl = await getConfig(CONFIG_KEYS.PAPERLESS_URL);
    const paperlessToken = await getConfigSecure(CONFIG_KEYS.PAPERLESS_TOKEN);

    if (paperlessUrl && paperlessToken) {
      const client = new PaperlessClient(paperlessUrl, paperlessToken);
      const isConnected = await client.validateConnection();

      statuses.paperless = {
        status: isConnected ? 'connected' : 'error',
        message: isConnected ? 'Verbunden' : 'Verbindung fehlgeschlagen',
      };
    } else {
      statuses.paperless = {
        status: 'not_configured',
        message: 'Nicht konfiguriert',
      };
    }
  } catch (error: any) {
    statuses.paperless = {
      status: 'error',
      message: error.message || t('status.error'),
    };
  }

  // Check Gemini AI
  try {
    const geminiApiKey = await getConfigSecure(CONFIG_KEYS.GEMINI_API_KEY);

    if (geminiApiKey) {
      // Quick validation - just check if key exists and has correct format
      const isValid = geminiApiKey.startsWith('AIza') && geminiApiKey.length > 30;

      statuses.gemini = {
        status: isValid ? 'connected' : 'error',
        message: isValid ? 'Konfiguriert' : 'Ungültiger API Key',
      };
    } else {
      statuses.gemini = {
        status: 'not_configured',
        message: 'Nicht konfiguriert',
      };
    }
  } catch (error: any) {
    statuses.gemini = {
      status: 'error',
      message: error.message || t('status.error'),
    };
  }

  // Check Document AI
  try {
    const projectId = await getConfig(CONFIG_KEYS.GOOGLE_CLOUD_PROJECT_ID);
    const credentials = await getConfigSecure(CONFIG_KEYS.GOOGLE_CLOUD_CREDENTIALS);
    const processorId = await getConfig(CONFIG_KEYS.DOCUMENT_AI_PROCESSOR_ID);

    if (projectId && credentials && processorId) {
      statuses.documentAI = {
        status: 'connected',
        message: 'Konfiguriert',
      };
    } else {
      statuses.documentAI = {
        status: 'not_configured',
        message: 'Nicht konfiguriert',
      };
    }
  } catch (error: any) {
    statuses.documentAI = {
      status: 'error',
      message: error.message || t('status.error'),
    };
  }

  // Check Google OAuth
  try {
    const clientId = await getConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_CLIENT_ID);
    const clientSecret = await getConfigSecure(CONFIG_KEYS.GOOGLE_OAUTH_CLIENT_SECRET);

    if (clientId && clientSecret) {
      statuses.oauth = {
        status: 'connected',
        message: 'Konfiguriert',
      };
    } else {
      statuses.oauth = {
        status: 'not_configured',
        message: 'Nicht konfiguriert',
      };
    }
  } catch (error: any) {
    statuses.oauth = {
      status: 'error',
      message: error.message || t('status.error'),
    };
  }

  // Check FTP Server
  try {
    const ftpStatus = await serviceManager.getStatus('ftp');
    const ftpPort = await getConfig(CONFIG_KEYS.FTP_PORT);

    if (ftpStatus) {
      statuses.ftp = {
        status: ftpStatus.running ? 'connected' : ftpStatus.enabled ? 'error' : 'not_configured',
        message: ftpStatus.message,
        running: ftpStatus.running,
        enabled: ftpStatus.enabled,
        port: ftpPort || '21',
        details: ftpStatus.details,
      };
    } else {
      statuses.ftp = {
        status: 'error',
        message: 'Fehler beim Abrufen des FTP-Status',
        running: false,
        enabled: false,
        port: ftpPort || '21',
      };
    }
  } catch (error: any) {
    statuses.ftp = {
      status: 'error',
      message: error.message || t('status.error'),
      running: false,
      enabled: false,
    };
  }

  // Check Email
  try {
    const emailEnabled = (await getConfig(CONFIG_KEYS.EMAIL_ENABLED)) === 'true';
    const smtpServer = await getConfig(CONFIG_KEYS.SMTP_SERVER);
    const smtpUser = await getConfig(CONFIG_KEYS.SMTP_USER);

    if (emailEnabled && smtpServer && smtpUser) {
      statuses.email = {
        status: 'connected',
        message: 'Konfiguriert',
      };
    } else if (emailEnabled) {
      statuses.email = {
        status: 'error',
        message: 'Unvollständige Konfiguration',
      };
    } else {
      statuses.email = {
        status: 'not_configured',
        message: 'Deaktiviert',
      };
    }
  } catch (error: any) {
    statuses.email = {
      status: 'error',
      message: error.message || t('status.error'),
    };
  }

  // Check Worker
  try {
    const workerStatus = await serviceManager.getStatus('worker');
    if (workerStatus) {
      statuses.worker = {
        status: workerStatus.running ? 'connected' : 'not_configured',
        message: workerStatus.message,
      };
    } else {
      statuses.worker = {
        status: 'not_configured',
        message: 'Nicht implementiert',
      };
    }
  } catch (error: any) {
    statuses.worker = {
      status: 'error',
      message: error.message || t('status.error'),
    };
  }

  return NextResponse.json(statuses);
}
