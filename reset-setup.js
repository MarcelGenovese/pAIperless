const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Set SETUP_COMPLETED to false to access setup wizard
  await prisma.config.upsert({
    where: { key: 'SETUP_COMPLETED' },
    update: { value: 'false' },
    create: { key: 'SETUP_COMPLETED', value: 'false' }
  });

  console.log('✓ Setup zurückgesetzt');
  console.log('');
  console.log('Sie können jetzt den Setup-Wizard aufrufen:');
  console.log('  http://localhost:3001/setup');
  console.log('');
  console.log('Oder direkt Paperless konfigurieren mit:');
  console.log('  node quick-setup.js');
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
