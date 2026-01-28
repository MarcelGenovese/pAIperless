const { DocumentProcessorServiceClient } = require('@google-cloud/documentai');
const fs = require('fs');

async function runTest() {
  const keyFilePath = '/home/marcel/documents-ai_backup/keys/service-account.json';
  
  if (!fs.existsSync(keyFilePath)) {
    console.error(`❌ Datei nicht gefunden: ${keyFilePath}`);
    return;
  }

  const credentials = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));

  // Daten aus deinen erfolgreichen Python-Lauf
  const projectId = 'gen-lang-client-0151377967'; 
  const projectNumber = '841608965746';           
  const location = 'eu';                           
  const processorId = '7e5c6ef084f5281';           

  console.log('--- Node.js Regionaler Test (EU) ---');

  // 1. Client-Initialisierung
  const client = new DocumentProcessorServiceClient({
    apiEndpoint: 'eu-documentai.googleapis.com',
    credentials,
    projectId: projectId,
  });

  // 2. Pfad-Konstruktion
  const name = `projects/${projectNumber}/locations/${location}/processors/${processorId}`;

  try {
    console.log(`⏳ Rufe Prozessor ab via: ${name}`);

    /**
     * DER ENTSCHEIDENDE FIX:
     * Wir übergeben den servicePath als zweites Argument direkt im Aufruf.
     * Das ist das Node-Äquivalent zu den Python 'ClientOptions'.
     */
    const [processor] = await client.getProcessor(
      { name }, 
      { servicePath: 'eu-documentai.googleapis.com' } 
    );

    console.log('✅ ERFOLG!');
    console.log(`Anzeige-Name: ${processor.displayName}`);
    console.log(`Status: ${processor.state}`);

  } catch (err) {
    console.error('❌ FEHLER:');
    console.error(err.message);
    
    if (err.message.includes('documentai.googleapis.com') && !err.message.includes('eu-')) {
        console.log('\n💡 Hinweis: Das SDK hat den eu-Endpoint trotz Anweisung ignoriert.');
    }
  }
}

runTest();
