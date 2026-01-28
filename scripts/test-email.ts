#!/usr/bin/env node
/**
 * Email Service Test Script
 *
 * Tests email functionality by:
 * 1. Loading email configuration from database
 * 2. Verifying SMTP connection
 * 3. Sending test email
 * 4. Displaying results
 */

import { PrismaClient } from '@prisma/client';
import emailService from '../lib/services/email-service';
import { getConfig, CONFIG_KEYS } from '../lib/config';

const prisma = new PrismaClient();

async function testEmail() {
  console.log('=== Email Service Test ===\n');

  try {
    // 1. Check if email is enabled
    console.log('1. Checking email configuration...');
    const emailEnabled = await getConfig(CONFIG_KEYS.EMAIL_ENABLED);
    const smtpServer = await getConfig(CONFIG_KEYS.SMTP_SERVER);
    const smtpPort = await getConfig(CONFIG_KEYS.SMTP_PORT);
    const smtpUser = await getConfig(CONFIG_KEYS.SMTP_USER);
    const emailSender = await getConfig(CONFIG_KEYS.EMAIL_SENDER);
    const emailRecipients = await getConfig(CONFIG_KEYS.EMAIL_RECIPIENTS);

    console.log(`   Email Enabled: ${emailEnabled || 'not set'}`);
    console.log(`   SMTP Server: ${smtpServer || 'not set'}`);
    console.log(`   SMTP Port: ${smtpPort || 'not set'}`);
    console.log(`   SMTP User: ${smtpUser || 'not set'}`);
    console.log(`   Email Sender: ${emailSender || 'not set'}`);
    console.log(`   Email Recipients: ${emailRecipients || 'not set'}`);
    console.log('');

    if (emailEnabled !== 'true') {
      console.log('❌ Email is not enabled in configuration');
      console.log('   Enable email in the setup wizard (Step 5) or run:');
      console.log('   npx tsx scripts/setup-test-email.ts');
      process.exit(1);
    }

    // 2. Get email status
    console.log('2. Getting email service status...');
    const status = await emailService.getStatus();
    console.log('   Status:', JSON.stringify(status, null, 2));
    console.log('');

    if (!status.configured) {
      console.log('❌ Email is not properly configured');
      console.log('   Error:', status.error);
      process.exit(1);
    }

    // 3. Verify SMTP connection
    console.log('3. Verifying SMTP connection...');
    const verifyResult = await emailService.verifyConnection();

    if (verifyResult.success) {
      console.log(`   ✅ ${verifyResult.message}`);
    } else {
      console.log(`   ❌ ${verifyResult.message}`);
      console.log('');
      console.log('Common issues:');
      console.log('   - Wrong SMTP server or port');
      console.log('   - Incorrect username or password');
      console.log('   - Firewall blocking SMTP port');
      console.log('   - Email provider requires app-specific password (Gmail)');
      console.log('   - TLS/SSL misconfiguration');
      process.exit(1);
    }
    console.log('');

    // 4. Send test email
    console.log('4. Sending test email...');
    const sendResult = await emailService.sendTestEmail();

    if (sendResult.success) {
      console.log(`   ✅ ${sendResult.message}`);
      console.log('');
      console.log('=== Test Successful ===');
      console.log('Check your inbox for the test email!');
      console.log('');
      console.log('Recipients:');
      if (status.recipients) {
        status.recipients.forEach((recipient) => {
          console.log(`   - ${recipient}`);
        });
      }
    } else {
      console.log(`   ❌ ${sendResult.message}`);
      process.exit(1);
    }

    // 5. Show recent email logs
    console.log('');
    console.log('5. Recent email logs:');
    const logs = await prisma.log.findMany({
      where: {
        message: {
          contains: '[Email]',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    if (logs.length === 0) {
      console.log('   No email logs found');
    } else {
      for (const log of logs) {
        console.log(`   [${log.createdAt.toISOString()}] ${log.level}: ${log.message}`);
      }
    }

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testEmail();
