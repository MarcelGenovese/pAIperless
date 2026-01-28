#!/usr/bin/env node
/**
 * pAIperless CLI Tool
 *
 * This tool allows management of pAIperless configuration from outside the container.
 * It provides commands for resetting tokens, managing config, and troubleshooting.
 *
 * Usage: node scripts/cli.js <command> [args]
 */

import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

const prisma = new PrismaClient();

// Audit log function
async function auditLog(action: string, details: string, user = 'cli') {
  try {
    await prisma.log.create({
      data: {
        level: 'INFO',
        message: `[AUDIT] ${action}`,
        meta: JSON.stringify({ action, details, user, timestamp: new Date().toISOString() }),
      },
    });
    console.log(`✅ Audit log: ${action}`);
  } catch (error) {
    console.error('⚠️  Failed to write audit log:', error);
  }
}

// Get config value
async function getConfig(key: string): Promise<string | null> {
  const config = await prisma.config.findUnique({ where: { key } });
  return config?.value || null;
}

// Set config value
async function setConfig(key: string, value: string): Promise<void> {
  await prisma.config.upsert({
    where: { key },
    update: { value, updatedAt: new Date() },
    create: { key, value },
  });
}

// Commands

async function resetPaperlessToken(token: string) {
  if (!token || token.trim() === '') {
    console.error('❌ Error: Token cannot be empty');
    process.exit(1);
  }

  try {
    await setConfig('PAPERLESS_TOKEN', token);
    await auditLog('reset-paperless-token', 'Paperless API token updated');
    console.log('✅ Paperless API token updated successfully');
    console.log('ℹ️  You can now login with the new token');
  } catch (error: any) {
    console.error('❌ Failed to reset token:', error.message);
    process.exit(1);
  }
}

async function resetPaperlessUrl(url: string) {
  if (!url || url.trim() === '') {
    console.error('❌ Error: URL cannot be empty');
    process.exit(1);
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    console.error('❌ Error: Invalid URL format');
    process.exit(1);
  }

  try {
    await setConfig('PAPERLESS_URL', url);
    await auditLog('reset-paperless-url', `Paperless URL updated to ${url}`);
    console.log('✅ Paperless URL updated successfully');
    console.log(`ℹ️  New URL: ${url}`);
  } catch (error: any) {
    console.error('❌ Failed to reset URL:', error.message);
    process.exit(1);
  }
}

async function resetSetup() {
  try {
    await setConfig('SETUP_COMPLETED', 'false');
    await auditLog('reset-setup', 'Setup flag reset - wizard will run on next access');
    console.log('✅ Setup reset successfully');
    console.log('ℹ️  Navigate to /setup to run the setup wizard again');
    console.log('ℹ️  Your existing configuration values will be preserved and pre-filled');
  } catch (error: any) {
    console.error('❌ Failed to reset setup:', error.message);
    process.exit(1);
  }
}

async function listConfig(showSecrets = false) {
  try {
    const configs = await prisma.config.findMany({
      orderBy: { key: 'asc' },
    });

    console.log('\n📋 Configuration Values:\n');

    const secretKeys = [
      'PAPERLESS_TOKEN',
      'GEMINI_API_KEY',
      'GOOGLE_CLOUD_CREDENTIALS',
      'GOOGLE_OAUTH_CLIENT_SECRET',
      'SMTP_PASSWORD',
      'FTP_PASSWORD',
      'WEBHOOK_API_KEY',
    ];

    for (const config of configs) {
      const isSecret = secretKeys.some(k => config.key.includes(k));
      let displayValue = config.value;

      if (isSecret && !showSecrets) {
        displayValue = '***HIDDEN***';
      }

      // Truncate long values
      if (displayValue && displayValue.length > 100 && !showSecrets) {
        displayValue = displayValue.substring(0, 100) + '...';
      }

      console.log(`${config.key}: ${displayValue}`);
    }

    console.log(`\n✅ Total: ${configs.length} configuration entries`);

    if (!showSecrets) {
      console.log('\nℹ️  Secret values are hidden. Use --show-secrets to display them (use with caution).');
    }
  } catch (error: any) {
    console.error('❌ Failed to list config:', error.message);
    process.exit(1);
  }
}

async function getConfigValue(key: string, showSecret = false) {
  try {
    const value = await getConfig(key);

    if (value === null) {
      console.error(`❌ Configuration key "${key}" not found`);
      process.exit(1);
    }

    const secretKeys = [
      'PAPERLESS_TOKEN',
      'GEMINI_API_KEY',
      'GOOGLE_CLOUD_CREDENTIALS',
      'GOOGLE_OAUTH_CLIENT_SECRET',
      'SMTP_PASSWORD',
      'FTP_PASSWORD',
      'WEBHOOK_API_KEY',
    ];

    const isSecret = secretKeys.some(k => key.includes(k));

    if (isSecret && !showSecret) {
      console.log(`${key}: ***HIDDEN***`);
      console.log('\nℹ️  This is a secret value. Use --show-secret to display it (use with caution).');
    } else {
      console.log(`${key}: ${value}`);
    }
  } catch (error: any) {
    console.error('❌ Failed to get config:', error.message);
    process.exit(1);
  }
}

async function setConfigValue(key: string, value: string) {
  try {
    await setConfig(key, value);
    await auditLog('set-config', `Configuration key "${key}" updated`);
    console.log(`✅ Configuration key "${key}" updated successfully`);
  } catch (error: any) {
    console.error('❌ Failed to set config:', error.message);
    process.exit(1);
  }
}

async function generateWebhookKey() {
  try {
    const key = randomBytes(32).toString('hex');
    await setConfig('WEBHOOK_API_KEY', key);
    await auditLog('generate-webhook-key', 'New webhook API key generated');
    console.log('✅ New webhook API key generated successfully');
    console.log(`ℹ️  Key: ${key}`);
    console.log('\n⚠️  Update this key in your Paperless-NGX webhook configuration!');
  } catch (error: any) {
    console.error('❌ Failed to generate webhook key:', error.message);
    process.exit(1);
  }
}

async function showSystemInfo() {
  try {
    const setupCompleted = await getConfig('SETUP_COMPLETED');
    const paperlessUrl = await getConfig('PAPERLESS_URL');
    const documentCount = await prisma.document.count();
    const completedCount = await prisma.document.count({ where: { status: 'COMPLETED' } });
    const errorCount = await prisma.document.count({ where: { status: 'ERROR' } });

    console.log('\n📊 System Information:\n');
    console.log(`Setup Completed: ${setupCompleted === 'true' ? 'Yes' : 'No'}`);
    console.log(`Paperless URL: ${paperlessUrl || 'Not configured'}`);
    console.log(`Total Documents: ${documentCount}`);
    console.log(`  - Completed: ${completedCount}`);
    console.log(`  - Errors: ${errorCount}`);
    console.log(`  - In Progress: ${documentCount - completedCount - errorCount}`);
  } catch (error: any) {
    console.error('❌ Failed to get system info:', error.message);
    process.exit(1);
  }
}

async function showLogs(limit = 50) {
  try {
    const logs = await prisma.log.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    if (logs.length === 0) {
      console.log('ℹ️  No logs found');
      return;
    }

    console.log(`\n📜 Recent Logs (showing ${logs.length}):\n`);

    for (const log of logs) {
      const timestamp = log.createdAt.toISOString();
      console.log(`[${timestamp}] ${log.level}: ${log.message}`);
      if (log.meta) {
        try {
          const metadata = JSON.parse(log.meta);
          console.log(`  Meta: ${JSON.stringify(metadata, null, 2)}`);
        } catch {
          console.log(`  Meta: ${log.meta}`);
        }
      }
    }
  } catch (error: any) {
    console.error('❌ Failed to get logs:', error.message);
    process.exit(1);
  }
}

// Help text
function showHelp() {
  console.log(`
pAIperless CLI Tool

Usage: manage.sh <command> [args]

Commands:
  reset-paperless-token <token>     Reset Paperless API token
  reset-paperless-url <url>         Reset Paperless URL
  reset-setup                       Reset setup flag (re-run wizard)
  list-config [--show-secrets]      List all configuration values
  get-config <key> [--show-secret]  Get a specific config value
  set-config <key> <value>          Set a config value
  generate-webhook-key              Generate new webhook API key
  system-info                       Show system information
  logs [limit]                      Show recent logs (default: 50)
  help                              Show this help message

Examples:
  # Reset Paperless token (use stdin for security)
  echo "your-new-token" | manage.sh reset-paperless-token

  # Reset Paperless URL
  manage.sh reset-paperless-url "http://paperless:8000"

  # Reset setup to re-run wizard
  manage.sh reset-setup

  # List all config (secrets hidden)
  manage.sh list-config

  # List all config (show secrets)
  manage.sh list-config --show-secrets

  # Get specific config value
  manage.sh get-config PAPERLESS_URL

  # Set config value
  manage.sh set-config SOME_KEY "some value"

  # Generate new webhook API key
  manage.sh generate-webhook-key

  # Show system info
  manage.sh system-info

  # Show recent logs
  manage.sh logs 100

Security Notes:
  - Use stdin to pass secrets (prevents them appearing in bash history)
  - All critical operations are logged to audit log
  - Use --show-secrets flag with caution
`);
}

// Main command dispatcher
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    process.exit(0);
  }

  try {
    switch (command) {
      case 'reset-paperless-token': {
        let token = args[1];
        if (!token) {
          // Try to read from stdin
          const stdin = await new Promise<string>((resolve) => {
            let data = '';
            process.stdin.on('data', (chunk) => {
              data += chunk;
            });
            process.stdin.on('end', () => {
              resolve(data.trim());
            });
            // If stdin is a TTY, there's no piped input
            if (process.stdin.isTTY) {
              resolve('');
            }
          });
          token = stdin;
        }
        if (!token) {
          console.error('❌ Error: Token required. Usage: reset-paperless-token <token>');
          console.error('   or pipe it: echo "token" | manage.sh reset-paperless-token');
          process.exit(1);
        }
        await resetPaperlessToken(token);
        break;
      }

      case 'reset-paperless-url': {
        const url = args[1];
        if (!url) {
          console.error('❌ Error: URL required. Usage: reset-paperless-url <url>');
          process.exit(1);
        }
        await resetPaperlessUrl(url);
        break;
      }

      case 'reset-setup': {
        await resetSetup();
        break;
      }

      case 'list-config': {
        const showSecrets = args.includes('--show-secrets');
        await listConfig(showSecrets);
        break;
      }

      case 'get-config': {
        const key = args[1];
        if (!key) {
          console.error('❌ Error: Key required. Usage: get-config <key>');
          process.exit(1);
        }
        const showSecret = args.includes('--show-secret');
        await getConfigValue(key, showSecret);
        break;
      }

      case 'set-config': {
        const key = args[1];
        const value = args[2];
        if (!key || !value) {
          console.error('❌ Error: Key and value required. Usage: set-config <key> <value>');
          process.exit(1);
        }
        await setConfigValue(key, value);
        break;
      }

      case 'generate-webhook-key': {
        await generateWebhookKey();
        break;
      }

      case 'system-info': {
        await showSystemInfo();
        break;
      }

      case 'logs': {
        const limit = args[1] ? parseInt(args[1], 10) : 50;
        await showLogs(limit);
        break;
      }

      default: {
        console.error(`❌ Unknown command: ${command}`);
        console.error('Run "manage.sh help" for usage information');
        process.exit(1);
      }
    }
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle SIGINT/SIGTERM
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

main();
