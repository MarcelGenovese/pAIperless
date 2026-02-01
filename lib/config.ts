import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

// Configuration keys used throughout the application
export const CONFIG_KEYS = {
  // Setup State
  SETUP_COMPLETED: 'SETUP_COMPLETED',
  SETUP_LOCALE: 'SETUP_LOCALE',
  BASE_URL: 'BASE_URL',
  DARK_MODE: 'DARK_MODE',

  // Paperless
  PAPERLESS_URL: 'PAPERLESS_URL',
  PAPERLESS_TOKEN: 'PAPERLESS_TOKEN',
  WEBHOOK_API_KEY: 'WEBHOOK_API_KEY',

  // Gemini
  GEMINI_API_KEY: 'GEMINI_API_KEY',
  GEMINI_MODEL: 'GEMINI_MODEL',
  GEMINI_MONTHLY_TOKEN_LIMIT: 'GEMINI_MONTHLY_TOKEN_LIMIT',
  GEMINI_PROMPT_TEMPLATE: 'GEMINI_PROMPT_TEMPLATE', // Custom prompt template for document analysis
  GEMINI_TAG_MODE: 'GEMINI_TAG_MODE', // Tag generation mode: strict/flexible/free
  GEMINI_MAX_TAGS: 'GEMINI_MAX_TAGS', // Maximum number of tags AI can generate
  GEMINI_STRICT_CORRESPONDENTS: 'GEMINI_STRICT_CORRESPONDENTS', // Restrict to existing correspondents
  GEMINI_STRICT_DOCUMENT_TYPES: 'GEMINI_STRICT_DOCUMENT_TYPES', // Restrict to existing document types
  GEMINI_STRICT_STORAGE_PATHS: 'GEMINI_STRICT_STORAGE_PATHS', // Restrict to existing storage paths
  GEMINI_FILL_CUSTOM_FIELDS: 'GEMINI_FILL_CUSTOM_FIELDS', // Enable AI to fill custom fields during tagging
  GEMINI_COST_AMOUNT: 'GEMINI_COST_AMOUNT', // Cost amount for pricing calculation
  GEMINI_TOKEN_UNIT: 'GEMINI_TOKEN_UNIT', // Token unit for pricing (e.g., 1000000 for cost per million)

  // Google Cloud Document AI
  GOOGLE_CLOUD_PROJECT_ID: 'GOOGLE_CLOUD_PROJECT_ID',
  GOOGLE_CLOUD_CREDENTIALS: 'GOOGLE_CLOUD_CREDENTIALS', // JSON string
  DOCUMENT_AI_PROCESSOR_ID: 'DOCUMENT_AI_PROCESSOR_ID',
  DOCUMENT_AI_LOCATION: 'DOCUMENT_AI_LOCATION',
  DOCUMENT_AI_MAX_PAGES: 'DOCUMENT_AI_MAX_PAGES', // Max pages to send to Document AI
  DOCUMENT_AI_MAX_SIZE_MB: 'DOCUMENT_AI_MAX_SIZE_MB', // Max file size in MB
  DOCUMENT_AI_ENABLED: 'DOCUMENT_AI_ENABLED', // Enable/disable Document AI processing
  DOCUMENT_AI_SKIP_SEARCHABLE: 'DOCUMENT_AI_SKIP_SEARCHABLE', // Skip OCR if PDF already has text layer
  DOCUMENT_AI_MONTHLY_PAGE_LIMIT: 'DOCUMENT_AI_MONTHLY_PAGE_LIMIT', // Monthly page limit for cost control
  DOCUMENT_AI_COST_AMOUNT: 'DOCUMENT_AI_COST_AMOUNT', // Cost amount for pricing calculation
  DOCUMENT_AI_PAGE_UNIT: 'DOCUMENT_AI_PAGE_UNIT', // Page unit for pricing (e.g., 1000 for cost per 1000 pages)

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

  // Email Notification Settings
  EMAIL_NOTIFY_SUCCESS: 'EMAIL_NOTIFY_SUCCESS', // Send email on successful processing
  EMAIL_NOTIFY_ERROR: 'EMAIL_NOTIFY_ERROR', // Send email on errors
  EMAIL_NOTIFY_API_LIMIT: 'EMAIL_NOTIFY_API_LIMIT', // Send email when API limit reached
  EMAIL_NOTIFY_API_WARNING: 'EMAIL_NOTIFY_API_WARNING', // Send email when approaching limit
  EMAIL_API_WARNING_THRESHOLD: 'EMAIL_API_WARNING_THRESHOLD', // Percentage threshold for warnings (default 80)

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
  TAG_PAIPERLESS_PROCESSED: 'TAG_PAIPERLESS_PROCESSED', // Tag to mark documents processed by pAIperless
  FIELD_ACTION_DESCRIPTION: 'FIELD_ACTION_DESCRIPTION',
  FIELD_DUE_DATE: 'FIELD_DUE_DATE',
  PAPERLESS_OCR_MODE: 'PAPERLESS_OCR_MODE', // OCR mode: skip, redo, skip_noarchive, force

  // Polling
  POLL_CONSUME_ENABLED: 'POLL_CONSUME_ENABLED',
  POLL_CONSUME_INTERVAL: 'POLL_CONSUME_INTERVAL',
  POLL_ACTION_ENABLED: 'POLL_ACTION_ENABLED',
  POLL_ACTION_INTERVAL: 'POLL_ACTION_INTERVAL',
  POLL_AI_TODO_ENABLED: 'POLL_AI_TODO_ENABLED',
  POLL_AI_TODO_INTERVAL: 'POLL_AI_TODO_INTERVAL',
  POLL_TASK_COMPLETION_INTERVAL: 'POLL_TASK_COMPLETION_INTERVAL', // How often to check Google Tasks for completion (minutes)
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
