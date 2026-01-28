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
  console.log('Choose your email provider:');
  console.log('1. Mailtrap.io (recommended for testing)');
  console.log('2. Gmail with App Password');
  console.log('3. Outlook/Hotmail with App Password');
  console.log('4. Custom SMTP server');
  console.log('');
  console.log('ℹ️  For Gmail/Outlook: App Passwords are REQUIRED');
  console.log('   Gmail: https://myaccount.google.com/apppasswords');
  console.log('   Outlook: https://account.microsoft.com/security');
  console.log('');

  try {
    const setupType = await question('Choose setup type (1-4) or press Enter to skip: ');

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
      console.log('\n📧 Gmail Configuration');
      console.log('═══════════════════════════════════════════════════');
      console.log('WICHTIG: Gmail erfordert ein App-Passwort!');
      console.log('');
      console.log('Schritte:');
      console.log('1. 2FA aktivieren: https://myaccount.google.com/security');
      console.log('2. App-Passwort erstellen: https://myaccount.google.com/apppasswords');
      console.log('   - App: Mail');
      console.log('   - Gerät: pAIperless');
      console.log('3. 16-stelliges Passwort kopieren (ohne Leerzeichen)');
      console.log('');
      smtpServer = 'smtp.gmail.com';
      smtpPort = '587';
      smtpUser = await question('Gmail Address: ');
      smtpPassword = await question('App Password (16 digits, no spaces): ');
      emailSender = smtpUser;
      emailRecipients = await question('Recipients (comma-separated): ');
      smtpEncryption = 'STARTTLS';
    } else if (setupType === '3') {
      console.log('\n📧 Outlook/Hotmail Configuration');
      console.log('═══════════════════════════════════════════════════');
      console.log('EMPFOHLEN: Verwenden Sie ein App-Passwort für mehr Sicherheit');
      console.log('');
      console.log('App-Passwort erstellen:');
      console.log('1. https://account.microsoft.com/security');
      console.log('2. Advanced security options');
      console.log('3. App passwords → Create new');
      console.log('');
      smtpServer = 'smtp-mail.outlook.com';
      smtpPort = '587';
      smtpUser = await question('Outlook/Hotmail Address: ');
      console.log('');
      console.log('Passwort-Optionen:');
      console.log('A. App-Passwort (empfohlen, sicherer)');
      console.log('B. Normales Passwort (kann blockiert werden)');
      const passType = await question('Wählen Sie A oder B [A]: ') || 'A';
      if (passType.toUpperCase() === 'A') {
        smtpPassword = await question('App Password: ');
      } else {
        smtpPassword = await question('Normal Password: ');
      }
      emailSender = smtpUser;
      emailRecipients = await question('Recipients (comma-separated): ');
      smtpEncryption = 'STARTTLS';
    } else if (setupType === '4') {
      console.log('\n📧 Custom SMTP Configuration');
      console.log('═══════════════════════════════════════════════════');
      smtpServer = await question('SMTP Server: ');
      smtpPort = await question('SMTP Port [587]: ') || '587';
      smtpEncryption = await question('Encryption (NONE/STARTTLS/SSL) [STARTTLS]: ') || 'STARTTLS';
      smtpUser = await question('Username: ');
      smtpPassword = await question('Password: ');
      emailSender = await question('Sender Email: ');
      emailRecipients = await question('Recipients (comma-separated): ');
    } else {
      console.log('\n⏭️  Skipping email configuration');
      rl.close();
      await prisma.$disconnect();
      return;
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
