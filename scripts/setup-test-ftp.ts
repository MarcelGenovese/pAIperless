#!/usr/bin/env node
/**
 * Setup Test FTP Configuration
 *
 * Creates test FTP configuration in the database for testing
 */

import { PrismaClient } from '@prisma/client';
import { setConfig, setConfigSecure, CONFIG_KEYS } from '../lib/config';

const prisma = new PrismaClient();

async function setupTestFTP() {
  console.log('=== Setting up Test FTP Configuration ===\n');

  try {
    // Set test FTP configuration
    await setConfig(CONFIG_KEYS.FTP_ENABLED, 'true');
    await setConfig(CONFIG_KEYS.FTP_USERNAME, 'paiperless');
    await setConfigSecure(CONFIG_KEYS.FTP_PASSWORD, 'test123'); // Encrypted
    await setConfig(CONFIG_KEYS.FTP_PORT, '2121'); // Use 2121 to avoid needing root
    await setConfig(CONFIG_KEYS.FTP_ENABLE_TLS, 'false');

    console.log('✅ Test FTP configuration created:');
    console.log('   Username: paiperless');
    console.log('   Password: test123');
    console.log('   Port: 2121');
    console.log('   TLS: Disabled (for testing)');
    console.log('');
    console.log('You can now run: npx tsx scripts/test-ftp.ts');

  } catch (error: any) {
    console.error('❌ Failed to setup test configuration:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupTestFTP();
