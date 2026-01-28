#!/usr/bin/env node
/**
 * FTP Server Test Script
 *
 * This script tests the FTP server implementation by:
 * 1. Loading FTP configuration from database
 * 2. Starting the FTP server
 * 3. Checking if it's running
 * 4. Displaying connection details
 */

import { PrismaClient } from '@prisma/client';
import ftpServerService from '../lib/services/ftp-server';
import { getConfig, CONFIG_KEYS } from '../lib/config';

const prisma = new PrismaClient();

async function testFTP() {
  console.log('=== FTP Server Test ===\n');

  try {
    // 1. Check if FTP is enabled in config
    console.log('1. Checking FTP configuration...');
    const ftpEnabled = await getConfig(CONFIG_KEYS.FTP_ENABLED);
    const ftpUsername = await getConfig(CONFIG_KEYS.FTP_USERNAME);
    const ftpPort = await getConfig(CONFIG_KEYS.FTP_PORT);
    const ftpEnableTls = await getConfig(CONFIG_KEYS.FTP_ENABLE_TLS);

    console.log(`   FTP Enabled: ${ftpEnabled || 'not set'}`);
    console.log(`   FTP Username: ${ftpUsername || 'not set'}`);
    console.log(`   FTP Port: ${ftpPort || 'not set'}`);
    console.log(`   FTP TLS: ${ftpEnableTls || 'not set'}`);
    console.log('');

    if (ftpEnabled !== 'true') {
      console.log('❌ FTP is not enabled in configuration');
      console.log('   Enable FTP in the setup wizard (Step 8) to test the server');
      process.exit(1);
    }

    // 2. Get current status
    console.log('2. Getting current FTP status...');
    const status = await ftpServerService.getStatus();
    console.log('   Status:', JSON.stringify(status, null, 2));
    console.log('');

    // 3. Start FTP server
    console.log('3. Starting FTP server...');
    const startResult = await ftpServerService.start();

    if (startResult.success) {
      console.log(`   ✅ ${startResult.message}`);
    } else {
      console.log(`   ❌ ${startResult.message}`);
      process.exit(1);
    }
    console.log('');

    // 4. Verify it's running
    console.log('4. Verifying FTP server is running...');
    const newStatus = await ftpServerService.getStatus();

    if (newStatus.running) {
      console.log('   ✅ FTP server is running');
      console.log('');
      console.log('=== Connection Details ===');
      console.log(`   Host: localhost (or your server IP)`);
      console.log(`   Port: ${newStatus.port}`);
      console.log(`   Username: ${newStatus.username}`);
      console.log(`   Password: (check database or setup wizard)`);
      console.log(`   TLS: ${newStatus.tlsEnabled ? 'Enabled' : 'Disabled'}`);
      console.log('');
      console.log('=== Test FTP Connection ===');
      console.log('You can now test the FTP connection with:');
      console.log(`   ftp localhost ${newStatus.port}`);
      console.log('   Or use FileZilla/Cyberduck with the credentials above');
      console.log('');
      console.log('Upload a PDF file to test document processing!');
    } else {
      console.log('   ❌ FTP server is not running');
      console.log('   Error:', newStatus.error);
      process.exit(1);
    }

    // 5. Keep server running for testing
    console.log('');
    console.log('Press Ctrl+C to stop the FTP server and exit...');

    // Keep process alive
    await new Promise(() => {});

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

// Handle Ctrl+C
process.on('SIGINT', async () => {
  console.log('\n\nShutting down FTP server...');
  try {
    await ftpServerService.stop();
    console.log('✅ FTP server stopped');
  } catch (error) {
    console.error('Error stopping FTP server:', error);
  }
  await prisma.$disconnect();
  process.exit(0);
});

testFTP();
