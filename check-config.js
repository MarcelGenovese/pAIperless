const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Aktuelle Konfiguration ===\n');

  const configs = await prisma.config.findMany({
    orderBy: { key: 'asc' }
  });

  if (configs.length === 0) {
    console.log('Keine Konfiguration gefunden.\n');
    console.log('Führen Sie aus: node quick-setup.js');
    return;
  }

  const important = [
    'SETUP_COMPLETED',
    'PAPERLESS_URL',
    'PAPERLESS_TOKEN',
    'GEMINI_API_KEY',
    'GOOGLE_CLOUD_PROJECT_ID',
    'FTP_ENABLED',
    'EMAIL_ENABLED'
  ];

  console.log('Wichtige Einstellungen:');
  important.forEach(key => {
    const config = configs.find(c => c.key === key);
    if (config) {
      const value = config.value.length > 50
        ? config.value.substring(0, 50) + '...'
        : config.value;
      console.log(`  ${key}: ${value}`);
    } else {
      console.log(`  ${key}: NICHT GESETZT`);
    }
  });

  console.log(`\nGesamt: ${configs.length} Einstellungen`);

  const setupComplete = configs.find(c => c.key === 'SETUP_COMPLETED')?.value === 'true';
  const paperlessUrl = configs.find(c => c.key === 'PAPERLESS_URL')?.value;

  console.log('\nStatus:');
  console.log(`  Setup: ${setupComplete ? '✓ Abgeschlossen' : '✗ Nicht abgeschlossen'}`);
  console.log(`  Paperless URL: ${paperlessUrl ? '✓ Konfiguriert' : '✗ Fehlt'}`);

  if (!paperlessUrl) {
    console.log('\nLösung: node quick-setup.js');
  } else if (setupComplete) {
    console.log('\nSie können sich anmelden: http://localhost:3001/auth/login');
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
