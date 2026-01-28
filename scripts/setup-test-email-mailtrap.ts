#!/usr/bin/env node
/**
 * Quick Mailtrap Email Setup
 * 
 * Uses Mailtrap.io for testing (free tier available)
 */

import { PrismaClient } from '@prisma/client';
import { setConfig, setConfigSecure, CONFIG_KEYS } from '../lib/config';

const prisma = new PrismaClient();

async function setupMailtrap() {
  console.log('=== Quick Mailtrap Email Setup ===\n');
  console.log('This sets up email using Mailtrap.io test SMTP.');
  console.log('Get your credentials from: https://mailtrap.io/inboxes');
  console.log('');

  const config = {
    smtpServer: 'sandbox.smtp.mailtrap.io',
    smtpPort: '2525',
    smtpUser: 'test-user',
    smtpPassword: 'test-password',
    emailSender: 'noreply@paiperless.test',
    emailRecipients: 'test@example.com',
    smtpEncryption: 'STARTTLS',
  };

  try {
    await setConfig(CONFIG_KEYS.EMAIL_ENABLED, 'true');
    await setConfig(CONFIG_KEYS.SMTP_SERVER, config.smtpServer);
    await setConfig(CONFIG_KEYS.SMTP_PORT, config.smtpPort);
    await setConfig(CONFIG_KEYS.SMTP_ENCRYPTION, config.smtpEncryption);
    await setConfig(CONFIG_KEYS.SMTP_USER, config.smtpUser);
    await setConfigSecure(CONFIG_KEYS.SMTP_PASSWORD, config.smtpPassword);
    await setConfig(CONFIG_KEYS.EMAIL_SENDER, config.emailSender);
    await setConfig(CONFIG_KEYS.EMAIL_RECIPIENTS, config.emailRecipients);

    console.log('✅ Test email configuration saved');
    console.log('');
    console.log('Configuration:');
    console.log(`   SMTP: ${config.smtpServer}:${config.smtpPort}`);
    console.log(`   User: ${config.smtpUser}`);
    console.log(`   From: ${config.emailSender}`);
    console.log(`   To: ${config.emailRecipients}`);
    console.log('');
    console.log('⚠️  This is a TEST configuration with dummy credentials.');
    console.log('    Update with real Mailtrap credentials to actually test email.');
    console.log('');
    console.log('To update credentials, run:');
    console.log('   npx tsx scripts/setup-test-email.ts');

  } catch (error: any) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupMailtrap();
