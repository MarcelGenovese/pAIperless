import nodemailer from 'nodemailer';
import { getConfig, getConfigSecure, CONFIG_KEYS } from './config';
import { createLogger } from './logger';

const logger = createLogger('Email');

/**
 * Get nodemailer transporter based on config
 */
async function getTransporter() {
  const enabled = await getConfig(CONFIG_KEYS.EMAIL_ENABLED);
  if (enabled !== 'true') {
    return null;
  }

  const smtpServer = await getConfig(CONFIG_KEYS.SMTP_SERVER);
  const smtpPort = parseInt(await getConfig(CONFIG_KEYS.SMTP_PORT) || '587', 10);
  const smtpEncryption = await getConfig(CONFIG_KEYS.SMTP_ENCRYPTION) || 'TLS';
  const smtpUser = await getConfig(CONFIG_KEYS.SMTP_USER);
  const smtpPassword = await getConfigSecure(CONFIG_KEYS.SMTP_PASSWORD);

  if (!smtpServer || !smtpUser || !smtpPassword) {
    await logger.warn('Email not configured properly, skipping');
    return null;
  }

  const secure = smtpEncryption === 'SSL';

  return nodemailer.createTransport({
    host: smtpServer,
    port: smtpPort,
    secure,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });
}

/**
 * Send email notification
 */
async function sendEmail(subject: string, htmlContent: string, textContent?: string) {
  try {
    const transporter = await getTransporter();
    if (!transporter) {
      return; // Email disabled or not configured
    }

    const sender = await getConfig(CONFIG_KEYS.EMAIL_SENDER);
    const recipients = await getConfig(CONFIG_KEYS.EMAIL_RECIPIENTS);

    if (!sender || !recipients) {
      await logger.warn('Email sender or recipients not configured');
      return;
    }

    const info = await transporter.sendMail({
      from: sender,
      to: recipients,
      subject: `pAIperless: ${subject}`,
      text: textContent || htmlContent.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      html: htmlContent,
    });

    await logger.info(`Email sent: ${subject}`, { messageId: info.messageId });
  } catch (error: any) {
    await logger.error('Failed to send email', error);
  }
}

/**
 * Send notification for successfully processed document
 */
export async function sendDocumentProcessedEmail(
  documentTitle: string,
  paperlessId: number,
  tokensUsed: number
) {
  // Check if success notifications are enabled
  const notifySuccess = await getConfig(CONFIG_KEYS.EMAIL_NOTIFY_SUCCESS);
  if (notifySuccess !== 'true') {
    return;
  }

  const paperlessUrl = await getConfig(CONFIG_KEYS.PAPERLESS_URL);
  const baseUrl = await getConfig(CONFIG_KEYS.BASE_URL);
  const documentUrl = `${paperlessUrl}/documents/${paperlessId}`;
  const dashboardUrl = baseUrl ? `${baseUrl}/dashboard?tab=documents` : null;

  const subject = `Dokument verarbeitet: ${documentTitle}`;
  const html = `
    <h2>✅ Dokument erfolgreich verarbeitet</h2>
    <p><strong>Titel:</strong> ${documentTitle}</p>
    <p><strong>Paperless ID:</strong> ${paperlessId}</p>
    <p><strong>Tokens verwendet:</strong> ${tokensUsed.toLocaleString('de-DE')}</p>
    <p><a href="${documentUrl}" style="color: #0066CC;">Dokument in Paperless öffnen</a></p>
    ${dashboardUrl ? `<p><a href="${dashboardUrl}" style="color: #0066CC;">Dashboard öffnen</a></p>` : ''}
    <hr>
    <p style="color: #666; font-size: 12px;">Diese Nachricht wurde automatisch von pAIperless gesendet.</p>
  `;

  await sendEmail(subject, html);
}

/**
 * Send notification for document processing error
 */
export async function sendDocumentErrorEmail(
  documentTitle: string,
  errorMessage: string,
  documentId?: number
) {
  // Check if error notifications are enabled
  const notifyError = await getConfig(CONFIG_KEYS.EMAIL_NOTIFY_ERROR);
  if (notifyError !== 'true') {
    return;
  }

  const baseUrl = await getConfig(CONFIG_KEYS.BASE_URL);
  const dashboardUrl = baseUrl ? `${baseUrl}/dashboard?tab=documents` : null;

  const subject = `⚠️ Fehler bei Dokumentverarbeitung: ${documentTitle}`;
  const html = `
    <h2>❌ Fehler bei Dokumentverarbeitung</h2>
    <p><strong>Titel:</strong> ${documentTitle}</p>
    ${documentId ? `<p><strong>Document ID:</strong> ${documentId}</p>` : ''}
    <p><strong>Fehler:</strong></p>
    <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto;">${errorMessage}</pre>
    <p>Das Dokument wurde in den Fehler-Status verschoben und kann über das Dashboard erneut verarbeitet werden.</p>
    ${dashboardUrl ? `<p><a href="${dashboardUrl}" style="display: inline-block; padding: 10px 20px; background: #DC2626; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Dashboard öffnen und Problem beheben</a></p>` : ''}
    <hr>
    <p style="color: #666; font-size: 12px;">Diese Nachricht wurde automatisch von pAIperless gesendet.</p>
  `;

  await sendEmail(subject, html);
}

/**
 * Send notification for action required documents
 */
export async function sendActionRequiredEmail(
  documentTitle: string,
  paperlessId: number,
  actionDescription: string,
  dueDate?: string
) {
  const paperlessUrl = await getConfig(CONFIG_KEYS.PAPERLESS_URL);
  const documentUrl = `${paperlessUrl}/documents/${paperlessId}`;

  const subject = `🔔 Aktion erforderlich: ${documentTitle}`;
  const html = `
    <h2>📋 Aktion erforderlich</h2>
    <p><strong>Dokument:</strong> ${documentTitle}</p>
    <p><strong>Aktion:</strong> ${actionDescription}</p>
    ${dueDate ? `<p><strong>Fällig am:</strong> ${new Date(dueDate).toLocaleDateString('de-DE')}</p>` : ''}
    <p><a href="${documentUrl}">Dokument in Paperless öffnen</a></p>
    <p>Eine Aufgabe wurde in Google Tasks erstellt und ein Kalendereintrag wurde hinzugefügt.</p>
    <hr>
    <p style="color: #666; font-size: 12px;">Diese Nachricht wurde automatisch von pAIperless gesendet.</p>
  `;

  await sendEmail(subject, html);
}

/**
 * Send batch processing summary email
 */
export async function sendBatchSummaryEmail(
  totalProcessed: number,
  successful: number,
  failed: number,
  totalTokens: number
) {
  const subject = `Stapelverarbeitung abgeschlossen: ${totalProcessed} Dokumente`;
  const html = `
    <h2>📊 Stapelverarbeitung abgeschlossen</h2>
    <p><strong>Gesamt verarbeitet:</strong> ${totalProcessed}</p>
    <p style="color: green;"><strong>✅ Erfolgreich:</strong> ${successful}</p>
    <p style="color: red;"><strong>❌ Fehlgeschlagen:</strong> ${failed}</p>
    <p><strong>Tokens verwendet:</strong> ${totalTokens.toLocaleString('de-DE')}</p>
    <hr>
    <p style="color: #666; font-size: 12px;">Diese Nachricht wurde automatisch von pAIperless gesendet.</p>
  `;

  await sendEmail(subject, html);
}

/**
 * Send monthly usage summary
 */
export async function sendMonthlySummaryEmail(
  month: string,
  documentsProcessed: number,
  tokensUsed: number,
  estimatedCost: number
) {
  const subject = `Monatszusammenfassung ${month}`;
  const html = `
    <h2>📈 Monatszusammenfassung ${month}</h2>
    <p><strong>Dokumente verarbeitet:</strong> ${documentsProcessed}</p>
    <p><strong>Tokens verwendet:</strong> ${tokensUsed.toLocaleString('de-DE')}</p>
    <p><strong>Geschätzte Kosten:</strong> $${estimatedCost.toFixed(2)}</p>
    <hr>
    <p style="color: #666; font-size: 12px;">Diese Nachricht wurde automatisch von pAIperless gesendet.</p>
  `;

  await sendEmail(subject, html);
}

/**
 * Send notification when API limit reached
 */
export async function sendAPILimitReachedEmail(
  apiType: 'gemini' | 'documentai',
  currentUsage: number,
  limit: number,
  month: string
) {
  // Check if API limit notifications are enabled
  const notifyLimit = await getConfig(CONFIG_KEYS.EMAIL_NOTIFY_API_LIMIT);
  if (notifyLimit !== 'true') {
    return;
  }

  const apiName = apiType === 'gemini' ? 'Gemini API (Tokens)' : 'Document AI (Seiten)';
  const baseUrl = await getConfig(CONFIG_KEYS.BASE_URL);
  const dashboardUrl = baseUrl ? `${baseUrl}/dashboard?tab=advanced` : null;

  const subject = `🚨 API-Limit erreicht: ${apiName}`;
  const html = `
    <h2 style="color: #DC2626;">🚨 API-Limit erreicht</h2>
    <p><strong>API:</strong> ${apiName}</p>
    <p><strong>Monat:</strong> ${month}</p>
    <p><strong>Aktuelle Nutzung:</strong> ${currentUsage.toLocaleString('de-DE')}</p>
    <p><strong>Limit:</strong> ${limit.toLocaleString('de-DE')}</p>
    <p><strong>Auslastung:</strong> ${((currentUsage / limit) * 100).toFixed(1)}%</p>
    <hr>
    <p style="color: #DC2626; font-weight: bold;">Warnung: Das monatliche API-Limit wurde erreicht!</p>
    <p>Weitere Dokumente können möglicherweise nicht mehr verarbeitet werden, bis das Limit erhöht wird oder der nächste Monat beginnt.</p>
    ${dashboardUrl ? `<p><a href="${dashboardUrl}" style="display: inline-block; padding: 10px 20px; background: #DC2626; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Dashboard öffnen und Limit anpassen</a></p>` : ''}
    <hr>
    <p style="color: #666; font-size: 12px;">Diese Nachricht wurde automatisch von pAIperless gesendet.</p>
  `;

  await sendEmail(subject, html);
}

/**
 * Send notification when approaching API limit
 */
export async function sendAPILimitWarningEmail(
  apiType: 'gemini' | 'documentai',
  currentUsage: number,
  limit: number,
  percentage: number,
  month: string
) {
  // Check if API warning notifications are enabled
  const notifyWarning = await getConfig(CONFIG_KEYS.EMAIL_NOTIFY_API_WARNING);
  if (notifyWarning !== 'true') {
    return;
  }

  const apiName = apiType === 'gemini' ? 'Gemini API (Tokens)' : 'Document AI (Seiten)';
  const baseUrl = await getConfig(CONFIG_KEYS.BASE_URL);
  const dashboardUrl = baseUrl ? `${baseUrl}/dashboard?tab=advanced` : null;
  const remaining = limit - currentUsage;

  const subject = `⚠️ API-Limit-Warnung: ${apiName} bei ${percentage.toFixed(0)}%`;
  const html = `
    <h2 style="color: #F59E0B;">⚠️ API-Limit-Warnung</h2>
    <p><strong>API:</strong> ${apiName}</p>
    <p><strong>Monat:</strong> ${month}</p>
    <p><strong>Aktuelle Nutzung:</strong> ${currentUsage.toLocaleString('de-DE')}</p>
    <p><strong>Limit:</strong> ${limit.toLocaleString('de-DE')}</p>
    <p><strong>Verbleibend:</strong> ${remaining.toLocaleString('de-DE')}</p>
    <p><strong>Auslastung:</strong> <span style="color: #F59E0B; font-weight: bold;">${percentage.toFixed(1)}%</span></p>
    <hr>
    <p>Sie nähern sich dem monatlichen API-Limit. Bitte überwachen Sie die Nutzung oder erhöhen Sie das Limit bei Bedarf.</p>
    ${dashboardUrl ? `<p><a href="${dashboardUrl}" style="display: inline-block; padding: 10px 20px; background: #F59E0B; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Dashboard öffnen</a></p>` : ''}
    <hr>
    <p style="color: #666; font-size: 12px;">Diese Nachricht wurde automatisch von pAIperless gesendet.</p>
  `;

  await sendEmail(subject, html);
}

/**
 * Test email configuration
 */
export async function sendTestEmail(testRecipient?: string) {
  try {
    const transporter = await getTransporter();
    if (!transporter) {
      throw new Error('Email not configured');
    }

    const sender = await getConfig(CONFIG_KEYS.EMAIL_SENDER);
    const recipients = testRecipient || await getConfig(CONFIG_KEYS.EMAIL_RECIPIENTS);

    if (!sender || !recipients) {
      throw new Error('Email sender or recipients not configured');
    }

    const info = await transporter.sendMail({
      from: sender,
      to: recipients,
      subject: 'pAIperless: Test Email',
      text: 'Wenn Sie diese E-Mail erhalten haben, funktioniert Ihre E-Mail-Konfiguration korrekt!',
      html: `
        <h2>✅ Test erfolgreich!</h2>
        <p>Wenn Sie diese E-Mail erhalten haben, funktioniert Ihre E-Mail-Konfiguration korrekt!</p>
        <hr>
        <p style="color: #666; font-size: 12px;">Diese Nachricht wurde automatisch von pAIperless gesendet.</p>
      `,
    });

    await logger.info('Test email sent successfully', { messageId: info.messageId });
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    await logger.error('Failed to send test email', error);
    throw error;
  }
}
