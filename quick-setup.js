const { PrismaClient } = require('@prisma/client');
const readline = require('readline');
const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('=== Quick Setup für pAIperless ===');
  console.log('');
  console.log('Minimale Konfiguration für Login:');
  console.log('');

  // Get Paperless URL
  const paperlessUrl = await question('Paperless-NGX URL (z.B. http://192.168.8.250:8000): ');

  if (!paperlessUrl) {
    console.error('✗ Paperless URL ist erforderlich');
    process.exit(1);
  }

  // Save config
  await prisma.config.upsert({
    where: { key: 'PAPERLESS_URL' },
    update: { value: paperlessUrl },
    create: { key: 'PAPERLESS_URL', value: paperlessUrl }
  });

  await prisma.config.upsert({
    where: { key: 'SETUP_COMPLETED' },
    update: { value: 'true' },
    create: { key: 'SETUP_COMPLETED', value: 'true' }
  });

  console.log('');
  console.log('✓ Setup abgeschlossen!');
  console.log('');
  console.log('Sie können sich jetzt anmelden mit Ihren Paperless-Credentials:');
  console.log('  http://localhost:3001/auth/login');
  console.log('');
  console.log('Wichtig: Sie brauchen einen Paperless-Admin-Account!');

  rl.close();
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    rl.close();
    process.exit(1);
  });
