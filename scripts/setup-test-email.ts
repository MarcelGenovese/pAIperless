#!/usr/bin/env node
/**
 * Setup Test Email Configuration
 *
 * Creates test email configuration in the database for testing.
 *
 * For testing, you can use:
 * - Mailtrap.io (free testing SMTP)
 * - Gmail with App Password
 * - Local SMTP server (e.g., MailHog)
 */

import { PrismaClient } from '@prisma/client';
import { setConfig, setConfigSecure, CONFIG_KEYS } from '../lib/config';
import * as readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function setupTestEmail() {
  console.log('=== Email Configuration Setup ===\n');
  console.log('You can use one of these test SMTP services:');
  console.log('1. Mailtrap.io (recommended for testing)');
  console.log('2. Gmail with App Password');
  console.log('3. Your own SMTP server');
  console.log('');

  try {
    const setupType = await question('Choose setup type (1-3) or press Enter to use example values: ');

    let smtpServer = 'smtp.mailtrap.io';
    let smtpPort = '2525';
    let smtpUser = 'your-mailtrap-username';
    let smtpPassword = 'your-mailtrap-password';
    let emailSender = 'noreply@paiperless.test';
    let emailRecipients = 'admin@example.com';
    let smtpEncryption = 'STARTTLS';

    if (setupType === '1') {
      console.log('\nMailtrap Configuration:');
      console.log('Sign up at https://mailtrap.io and get your credentials from the inbox settings.');
      smtpServer = await question('SMTP Server [smtp.mailtrap.io]: ') || 'smtp.mailtrap.io';
      smtpPort = await question('SMTP Port [2525]: ') || '2525';
      smtpUser = await question('Username: ');
      smtpPassword = await question('Password: ');
      emailSender = await question('Sender Email [noreply@paiperless.test]: ') || 'noreply@paiperless.test';
      emailRecipients = await question('Recipients (comma-separated) [admin@example.com]: ') || 'admin@example.com';
      smtpEncryption = 'STARTTLS';
    } else if (setupType === '2') {
      console.log('\nGmail Configuration:');
      console.log('Create an App Password at https://myaccount.google.com/apppasswords');
      smtpServer = 'smtp.gmail.com';
      smtpPort = '587';
      smtpUser = await question('Gmail Address: ');
      smtpPassword = await question('App Password: ');
      emailSender = smtpUser;
      emailRecipients = await question('Recipients (comma-separated): ');
      smtpEncryption = 'STARTTLS';
    } else if (setupType === '3') {
      console.log('\nCustom SMTP Configuration:');
      smtpServer = await question('SMTP Server: ');
      smtpPort = await question('SMTP Port [587]: ') || '587';
      smtpEncryption = await question('Encryption (NONE/STARTTLS/SSL) [STARTTLS]: ') || 'STARTTLS';
      smtpUser = await question('Username: ');
      smtpPassword = await question('Password: ');
      emailSender = await question('Sender Email: ');
      emailRecipients = await question('Recipients (comma-separated): ');
    } else {
      console.log('\nUsing example values (will not work for actual sending):');
    }

    // Save to database
    await setConfig(CONFIG_KEYS.EMAIL_ENABLED, 'true');
    await setConfig(CONFIG_KEYS.SMTP_SERVER, smtpServer);
    await setConfig(CONFIG_KEYS.SMTP_PORT, smtpPort);
    await setConfig(CONFIG_KEYS.SMTP_ENCRYPTION, smtpEncryption);
    await setConfig(CONFIG_KEYS.SMTP_USER, smtpUser);
    await setConfigSecure(CONFIG_KEYS.SMTP_PASSWORD, smtpPassword); // Encrypted
    await setConfig(CONFIG_KEYS.EMAIL_SENDER, emailSender);
    await setConfig(CONFIG_KEYS.EMAIL_RECIPIENTS, emailRecipients);

    console.log('\n✅ Email configuration saved:');
    console.log(`   SMTP Server: ${smtpServer}:${smtpPort}`);
    console.log(`   Encryption: ${smtpEncryption}`);
    console.log(`   Username: ${smtpUser}`);
    console.log(`   Sender: ${emailSender}`);
    console.log(`   Recipients: ${emailRecipients}`);
    console.log('');
    console.log('You can now test with: npx tsx scripts/test-email.ts');

  } catch (error: any) {
    console.error('❌ Failed to setup email configuration:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

setupTestEmail();
