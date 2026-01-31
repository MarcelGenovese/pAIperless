/**
 * Email Service
 *
 * Manages email sending via SMTP using nodemailer.
 * Configuration is loaded from the database.
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { getConfig, getConfigSecure, CONFIG_KEYS } from '@/lib/config';
import { prisma } from '@/lib/prisma';

interface EmailConfig {
  enabled: boolean;
  smtpServer: string;
  smtpPort: number;
  smtpEncryption: 'NONE' | 'STARTTLS' | 'SSL';
  smtpUser: string;
  smtpPassword: string;
  emailSender: string;
  emailRecipients: string[];
}

interface SendEmailOptions {
  to?: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

interface EmailServiceStatus {
  enabled: boolean;
  configured: boolean;
  smtpServer: string | null;
  smtpPort: number | null;
  sender: string | null;
  recipients: string[] | null;
  error: string | null;
}

class EmailService {
  private transporter: Transporter | null = null;
  private config: EmailConfig | null = null;

  /**
   * Load configuration from database
   */
  private async loadConfig(): Promise<boolean> {
    try {
      const enabled = (await getConfig(CONFIG_KEYS.EMAIL_ENABLED)) === 'true';

      if (!enabled) {
        this.config = null;
        return false;
      }

      const smtpServer = await getConfig(CONFIG_KEYS.SMTP_SERVER);
      const smtpPortStr = await getConfig(CONFIG_KEYS.SMTP_PORT);
      const smtpEncryption = await getConfig(CONFIG_KEYS.SMTP_ENCRYPTION);
      const smtpUser = await getConfig(CONFIG_KEYS.SMTP_USER);
      const smtpPassword = await getConfigSecure(CONFIG_KEYS.SMTP_PASSWORD);
      const emailSender = await getConfig(CONFIG_KEYS.EMAIL_SENDER);
      const emailRecipientsStr = await getConfig(CONFIG_KEYS.EMAIL_RECIPIENTS);

      if (!smtpServer || !smtpPortStr || !smtpUser || !smtpPassword || !emailSender || !emailRecipientsStr) {
        console.error('[Email] Missing required email configuration');
        this.config = null;
        return false;
      }

      const smtpPort = parseInt(smtpPortStr, 10);
      if (isNaN(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
        console.error('[Email] Invalid SMTP port:', smtpPortStr);
        this.config = null;
        return false;
      }

      const emailRecipients = emailRecipientsStr
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      if (emailRecipients.length === 0) {
        console.error('[Email] No valid recipients configured');
        this.config = null;
        return false;
      }

      this.config = {
        enabled,
        smtpServer,
        smtpPort,
        smtpEncryption: smtpEncryption as 'NONE' | 'STARTTLS' | 'SSL',
        smtpUser,
        smtpPassword,
        emailSender,
        emailRecipients,
      };

      return true;
    } catch (error) {
      console.error('[Email] Error loading configuration:', error);
      this.config = null;
      return false;
    }
  }

  /**
   * Log to database
   */
  private async log(level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: any) {
    try {
      await prisma.log.create({
        data: {
          level,
          message: `[Email] ${message}`,
          meta: meta ? JSON.stringify(meta) : null,
        },
      });
    } catch (error) {
      console.error('[Email] Failed to write log:', error);
    }
  }

  /**
   * Create SMTP transporter
   */
  private async createTransporter(): Promise<Transporter | null> {
    if (!this.config) {
      await this.loadConfig();
    }

    if (!this.config) {
      console.error('[Email] Cannot create transporter: configuration not loaded');
      return null;
    }

    try {
      const transportOptions: any = {
        host: this.config.smtpServer,
        port: this.config.smtpPort,
        auth: {
          user: this.config.smtpUser,
          pass: this.config.smtpPassword,
        },
      };

      // Configure encryption
      if (this.config.smtpEncryption === 'SSL') {
        transportOptions.secure = true; // Use SSL/TLS
      } else if (this.config.smtpEncryption === 'STARTTLS') {
        transportOptions.secure = false;
        transportOptions.requireTLS = true; // Upgrade to STARTTLS
      } else {
        transportOptions.secure = false;
        transportOptions.requireTLS = false;
      }

      // Additional security options
      transportOptions.tls = {
        rejectUnauthorized: false, // Allow self-signed certificates in development
      };

      this.transporter = nodemailer.createTransport(transportOptions);

      return this.transporter;
    } catch (error: any) {
      console.error('[Email] Failed to create transporter:', error);
      await this.log('ERROR', 'Failed to create transporter', { error: error.message });
      return null;
    }
  }

  /**
   * Send test email
   */
  async sendTestEmail(recipient?: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[Email] Sending test email...');

      const configLoaded = await this.loadConfig();
      if (!configLoaded || !this.config) {
        return { success: false, message: 'Email is not configured or disabled' };
      }

      console.log('[Email] Creating transporter with config:', {
        host: this.config.smtpServer,
        port: this.config.smtpPort,
        encryption: this.config.smtpEncryption,
        user: this.config.smtpUser,
      });

      const transporter = await this.createTransporter();
      if (!transporter) {
        return { success: false, message: 'Failed to create SMTP transporter - check server logs for details' };
      }

      const to = recipient || this.config.emailRecipients[0];
      console.log('[Email] Sending to:', to);
      console.log('[Email] From:', this.config.emailSender);

      const mailOptions = {
        from: this.config.emailSender,
        to,
        subject: 'pAIperless Test Email',
        text: 'This is a test email from pAIperless.\n\nIf you received this email, your email configuration is working correctly!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0066CC;">pAIperless Test Email</h2>
            <p>This is a test email from <strong>pAIperless</strong>.</p>
            <p>If you received this email, your email configuration is working correctly!</p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #6B7280; font-size: 12px;">
              Sent from pAIperless Email Service<br>
              ${new Date().toLocaleString()}
            </p>
          </div>
        `,
      };

      console.log('[Email] Attempting to send mail...');
      const info = await transporter.sendMail(mailOptions);

      const message = `Test email sent successfully to ${to}`;
      console.log(`[Email] ${message}`);
      console.log('[Email] Message ID:', info.messageId);
      console.log('[Email] Response:', info.response);

      await this.log('INFO', message, {
        to,
        messageId: info.messageId,
        response: info.response,
      });

      return { success: true, message };
    } catch (error: any) {
      // Extract detailed error information
      let errorDetails = error.message;

      // Check for specific nodemailer error types
      if (error.code) {
        errorDetails += ` (Code: ${error.code})`;
      }
      if (error.command) {
        errorDetails += ` during ${error.command}`;
      }
      if (error.responseCode) {
        errorDetails += ` - Server responded with code ${error.responseCode}`;
      }
      if (error.response) {
        errorDetails += ` - Server response: ${error.response}`;
      }

      const message = `Failed to send test email: ${errorDetails}`;
      console.error(`[Email] ${message}`);
      console.error('[Email] Full error:', error);

      await this.log('ERROR', message, {
        error: error.message,
        code: error.code,
        command: error.command,
        responseCode: error.responseCode,
        response: error.response,
        stack: error.stack
      });

      return { success: false, message };
    }
  }

  /**
   * Send email
   */
  async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; message: string }> {
    try {
      const configLoaded = await this.loadConfig();
      if (!configLoaded || !this.config) {
        return { success: false, message: 'Email is not configured or disabled' };
      }

      const transporter = await this.createTransporter();
      if (!transporter) {
        return { success: false, message: 'Failed to create SMTP transporter' };
      }

      // Determine recipients
      let recipients: string[];
      if (options.to) {
        recipients = Array.isArray(options.to) ? options.to : [options.to];
      } else {
        recipients = this.config.emailRecipients;
      }

      const mailOptions = {
        from: this.config.emailSender,
        to: recipients.join(', '),
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      const info = await transporter.sendMail(mailOptions);

      const message = `Email sent successfully to ${recipients.join(', ')}`;
      console.log(`[Email] ${message}`);

      await this.log('INFO', message, {
        to: recipients,
        subject: options.subject,
        messageId: info.messageId,
      });

      return { success: true, message };
    } catch (error: any) {
      const message = `Failed to send email: ${error.message}`;
      console.error(`[Email] ${message}`);
      await this.log('ERROR', message, { error: error.message, stack: error.stack });
      return { success: false, message };
    }
  }

  /**
   * Send notification email (convenience method)
   */
  async sendNotification(subject: string, message: string): Promise<{ success: boolean; message: string }> {
    return this.sendEmail({
      subject: `[pAIperless] ${subject}`,
      text: message,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0066CC;">${subject}</h2>
          <p style="white-space: pre-wrap;">${message}</p>
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
          <p style="color: #6B7280; font-size: 12px;">
            Sent from pAIperless Email Service<br>
            ${new Date().toLocaleString()}
          </p>
        </div>
      `,
    });
  }

  /**
   * Verify SMTP connection
   */
  async verifyConnection(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[Email] Verifying SMTP connection...');

      const configLoaded = await this.loadConfig();
      if (!configLoaded || !this.config) {
        const reason = await this._getConfigLoadFailureReason();
        return { success: false, message: `Email is not configured: ${reason}` };
      }

      console.log('[Email] Config loaded, creating transporter...');
      console.log('[Email] SMTP Server:', this.config.smtpServer);
      console.log('[Email] SMTP Port:', this.config.smtpPort);
      console.log('[Email] SMTP Encryption:', this.config.smtpEncryption);
      console.log('[Email] SMTP User:', this.config.smtpUser);

      const transporter = await this.createTransporter();
      if (!transporter) {
        return { success: false, message: 'Failed to create SMTP transporter - check server logs' };
      }

      console.log('[Email] Transporter created, verifying connection...');
      await transporter.verify();

      const message = `SMTP connection verified successfully (${this.config.smtpServer}:${this.config.smtpPort})`;
      console.log(`[Email] ${message}`);
      await this.log('INFO', message);

      return { success: true, message };
    } catch (error: any) {
      // Extract detailed error information
      let errorDetails = error.message;

      if (error.code) {
        errorDetails += ` (Error code: ${error.code})`;
      }
      if (error.errno) {
        errorDetails += ` errno: ${error.errno}`;
      }
      if (error.syscall) {
        errorDetails += ` during ${error.syscall}`;
      }

      const message = `SMTP connection verification failed: ${errorDetails}`;
      console.error(`[Email] ${message}`);
      console.error('[Email] Full error:', error);

      await this.log('ERROR', message, {
        error: error.message,
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        stack: error.stack
      });

      return { success: false, message };
    }
  }

  /**
   * Get detailed reason why config loading failed
   */
  private async _getConfigLoadFailureReason(): Promise<string> {
    try {
      const enabled = (await getConfig(CONFIG_KEYS.EMAIL_ENABLED)) === 'true';
      if (!enabled) {
        return 'Email notifications are disabled';
      }

      const missing: string[] = [];

      if (!await getConfig(CONFIG_KEYS.SMTP_SERVER)) missing.push('SMTP Server');
      if (!await getConfig(CONFIG_KEYS.SMTP_PORT)) missing.push('SMTP Port');
      if (!await getConfig(CONFIG_KEYS.SMTP_USER)) missing.push('SMTP Username');
      if (!await getConfigSecure(CONFIG_KEYS.SMTP_PASSWORD)) missing.push('SMTP Password');
      if (!await getConfig(CONFIG_KEYS.EMAIL_SENDER)) missing.push('Sender Email');
      if (!await getConfig(CONFIG_KEYS.EMAIL_RECIPIENTS)) missing.push('Recipients');

      if (missing.length > 0) {
        return `Missing configuration: ${missing.join(', ')}`;
      }

      return 'Unknown configuration error';
    } catch (error) {
      return 'Failed to check configuration';
    }
  }

  /**
   * Get email service status
   */
  async getStatus(): Promise<EmailServiceStatus> {
    try {
      await this.loadConfig();

      if (!this.config) {
        return {
          enabled: false,
          configured: false,
          smtpServer: null,
          smtpPort: null,
          sender: null,
          recipients: null,
          error: 'Email is not configured or disabled',
        };
      }

      return {
        enabled: this.config.enabled,
        configured: true,
        smtpServer: this.config.smtpServer,
        smtpPort: this.config.smtpPort,
        sender: this.config.emailSender,
        recipients: this.config.emailRecipients,
        error: null,
      };
    } catch (error: any) {
      return {
        enabled: false,
        configured: false,
        smtpServer: null,
        smtpPort: null,
        sender: null,
        recipients: null,
        error: error.message,
      };
    }
  }
}

// Singleton instance
const emailService = new EmailService();

export default emailService;
export { EmailService };
export type { EmailServiceStatus, SendEmailOptions };
