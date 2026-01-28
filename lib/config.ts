import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

// Configuration keys used throughout the application
export const CONFIG_KEYS = {
  // Setup State
  SETUP_COMPLETED: 'SETUP_COMPLETED',
  SETUP_LOCALE: 'SETUP_LOCALE',
  BASE_URL: 'BASE_URL',

  // Paperless
  PAPERLESS_URL: 'PAPERLESS_URL',
  PAPERLESS_TOKEN: 'PAPERLESS_TOKEN',
  WEBHOOK_API_KEY: 'WEBHOOK_API_KEY',

  // Gemini
  GEMINI_API_KEY: 'GEMINI_API_KEY',
  GEMINI_MODEL: 'GEMINI_MODEL',

  // Google Cloud Document AI
  GOOGLE_CLOUD_PROJECT_ID: 'GOOGLE_CLOUD_PROJECT_ID',
  GOOGLE_CLOUD_CREDENTIALS: 'GOOGLE_CLOUD_CREDENTIALS', // JSON string
  DOCUMENT_AI_PROCESSOR_ID: 'DOCUMENT_AI_PROCESSOR_ID',
  DOCUMENT_AI_LOCATION: 'DOCUMENT_AI_LOCATION',

  // Google OAuth
  GOOGLE_OAUTH_CLIENT_ID: 'GOOGLE_OAUTH_CLIENT_ID',
  GOOGLE_OAUTH_CLIENT_SECRET: 'GOOGLE_OAUTH_CLIENT_SECRET',
  GOOGLE_OAUTH_ACCESS_TOKEN: 'GOOGLE_OAUTH_ACCESS_TOKEN',
  GOOGLE_OAUTH_REFRESH_TOKEN: 'GOOGLE_OAUTH_REFRESH_TOKEN',
  GOOGLE_CALENDAR_ID: 'GOOGLE_CALENDAR_ID',
  GOOGLE_TASK_LIST_ID: 'GOOGLE_TASK_LIST_ID',

  // Email
  EMAIL_ENABLED: 'EMAIL_ENABLED',
  SMTP_SERVER: 'SMTP_SERVER',
  SMTP_PORT: 'SMTP_PORT',
  SMTP_ENCRYPTION: 'SMTP_ENCRYPTION',
  SMTP_USER: 'SMTP_USER',
  SMTP_PASSWORD: 'SMTP_PASSWORD',
  EMAIL_SENDER: 'EMAIL_SENDER',
  EMAIL_RECIPIENTS: 'EMAIL_RECIPIENTS',

  // FTP
  FTP_ENABLED: 'FTP_ENABLED',
  FTP_USERNAME: 'FTP_USERNAME',
  FTP_PASSWORD: 'FTP_PASSWORD',
  FTP_PORT: 'FTP_PORT',
  FTP_ENABLE_TLS: 'FTP_ENABLE_TLS',
  FTP_PASV_URL: 'FTP_PASV_URL',

  // Paperless Config
  TAG_AI_TODO: 'TAG_AI_TODO',
  TAG_ACTION_REQUIRED: 'TAG_ACTION_REQUIRED',
  FIELD_ACTION_DESCRIPTION: 'FIELD_ACTION_DESCRIPTION',
  FIELD_DUE_DATE: 'FIELD_DUE_DATE',

  // Polling
  POLL_CONSUME_ENABLED: 'POLL_CONSUME_ENABLED',
  POLL_CONSUME_INTERVAL: 'POLL_CONSUME_INTERVAL',
  POLL_ACTION_ENABLED: 'POLL_ACTION_ENABLED',
  POLL_ACTION_INTERVAL: 'POLL_ACTION_INTERVAL',
  POLL_AI_TODO_ENABLED: 'POLL_AI_TODO_ENABLED',
  POLL_AI_TODO_INTERVAL: 'POLL_AI_TODO_INTERVAL',
} as const;

// Encryption functions for sensitive data
const ALGORITHM = 'aes-256-cbc';

function getEncryptionKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not set');
  }
  return crypto.scryptSync(secret, 'salt', 32);
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(text: string): string {
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString();
}

// Configuration management functions
export async function getConfig(key: string): Promise<string | null> {
  try {
    const record = await prisma.config.findUnique({ where: { key } });
    return record?.value ?? null;
  } catch (error) {
    console.error(`Error getting config ${key}:`, error);
    return null;
  }
}

export async function setConfig(key: string, value: string): Promise<void> {
  try {
    await prisma.config.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  } catch (error) {
    console.error(`Error setting config ${key}:`, error);
    throw error;
  }
}

// Secure config management for sensitive data
export async function getConfigSecure(key: string): Promise<string | null> {
  const encrypted = await getConfig(key);
  if (!encrypted) return null;
  try {
    return decrypt(encrypted);
  } catch (error) {
    console.error(`Error decrypting config ${key}:`, error);
    return null;
  }
}

export async function setConfigSecure(key: string, value: string): Promise<void> {
  const encrypted = encrypt(value);
  await setConfig(key, encrypted);
}

// Check if setup is complete
export async function isSetupComplete(): Promise<boolean> {
  const value = await getConfig(CONFIG_KEYS.SETUP_COMPLETED);
  return value === 'true';
}

// Get current locale
export async function getLocale(): Promise<string> {
  const locale = await getConfig(CONFIG_KEYS.SETUP_LOCALE);
  return locale || 'en';
}
