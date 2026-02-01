#!/usr/bin/env node
/**
 * Use Gemini API to extract German strings and generate translation keys
 * This script only extracts strings, doesn't modify code
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Load .env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Track token usage
let totalInputTokens = 0;
let totalOutputTokens = 0;

// Encryption functions (copied from lib/config.ts)
const ALGORITHM = 'aes-256-cbc';

function getEncryptionKey() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not set in .env');
  }
  return crypto.scryptSync(secret, 'salt', 32);
}

function decrypt(text) {
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString();
}

async function getConfigFromDatabase(key) {
  const dbPath = path.join(__dirname, '..', 'prisma', 'storage', 'database', 'paiperless.db');

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        reject(new Error(`Cannot open database: ${err.message}`));
        return;
      }
    });

    db.get('SELECT value FROM Config WHERE key = ?', [key], (err, row) => {
      db.close();
      if (err) {
        reject(err);
      } else {
        resolve(row ? row.value : null);
      }
    });
  });
}

async function getGeminiClient() {
  // Get API key from command line argument or database
  let apiKey = process.argv[2];

  if (!apiKey) {
    // Get encrypted value from database
    const encryptedKey = await getConfigFromDatabase('GEMINI_API_KEY');
    if (encryptedKey) {
      try {
        apiKey = decrypt(encryptedKey);
        console.log('✓ Gemini API key loaded from database (decrypted)');
      } catch (error) {
        throw new Error(`Failed to decrypt API key: ${error.message}`);
      }
    }
  }

  if (!apiKey) {
    throw new Error('Gemini API key not found. Usage: node extract-translations-with-gemini.js YOUR_API_KEY');
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Use flash model for cost efficiency
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    generationConfig: {
      temperature: 0.1,
      topP: 1,
      topK: 1,
      maxOutputTokens: 4000
    }
  });

  return model;
}

async function extractStringsFromComponent(filePath) {
  console.log(`\n📄 Processing: ${filePath}`);

  const content = fs.readFileSync(filePath, 'utf8');
  const model = await getGeminiClient();

  const prompt = `Analyze this React component and extract ALL German hardcoded strings.

RULES:
1. Find ALL German strings (JSX text, toast messages, button labels, placeholders, CardTitle, CardDescription, etc.)
2. Ignore: English strings, variable names, import paths, className values, technical constants
3. Create snake_case translation keys (lowercase, underscores)
4. Group similar strings with similar key names

GERMAN INDICATORS:
- Contains: ä, ö, ü, ß, Ä, Ö, Ü
- German words: und, oder, für, von, mit, wird, wurde, können, müssen, etc.

Component:
\`\`\`tsx
${content}
\`\`\`

Return JSON array of objects with this structure:
[
  {
    "german": "Manuelle Verarbeitung",
    "key": "manual_processing",
    "context": "CardTitle"
  },
  {
    "german": "Tag-Verwaltung",
    "key": "tag_management",
    "context": "CardTitle"
  }
]

Return ONLY the JSON array, nothing else.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Track tokens
    if (response.usageMetadata) {
      const inputTokens = response.usageMetadata.promptTokenCount || 0;
      const outputTokens = response.usageMetadata.candidatesTokenCount || 0;
      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;
      console.log(`  📊 Tokens: ${inputTokens} in, ${outputTokens} out`);
    }

    // Extract JSON array from response (remove any text before/after)
    let jsonText = text.trim();

    // Remove markdown code blocks if present
    if (jsonText.includes('```json')) {
      jsonText = jsonText.replace(/^.*?```json\s*/s, '').replace(/\s*```.*$/s, '');
    } else if (jsonText.includes('```')) {
      jsonText = jsonText.replace(/^.*?```\s*/s, '').replace(/\s*```.*$/s, '');
    }

    // Find first [ and last ]
    const firstBracket = jsonText.indexOf('[');
    const lastBracket = jsonText.lastIndexOf(']');

    if (firstBracket === -1 || lastBracket === -1) {
      throw new Error('No JSON array found in response');
    }

    jsonText = jsonText.substring(firstBracket, lastBracket + 1);

    const parsed = JSON.parse(jsonText);

    if (!Array.isArray(parsed)) {
      throw new Error('Expected JSON array');
    }

    console.log(`  ✅ Found ${parsed.length} German strings`);

    return parsed;
  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}:`, error.message);
    return [];
  }
}

async function translateToEnglish(germanStrings) {
  console.log(`\n🔄 Translating ${germanStrings.length} strings to English...`);

  const model = await getGeminiClient();

  // Create simple object for translation
  const toTranslate = {};
  germanStrings.forEach(item => {
    toTranslate[item.key] = item.german;
  });

  const prompt = `Translate these German strings to English. Keep the same keys.

German strings:
${JSON.stringify(toTranslate, null, 2)}

Return JSON object with same keys but English values.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Track tokens
    if (response.usageMetadata) {
      const inputTokens = response.usageMetadata.promptTokenCount || 0;
      const outputTokens = response.usageMetadata.candidatesTokenCount || 0;
      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;
      console.log(`  📊 Tokens: ${inputTokens} in, ${outputTokens} out`);
    }

    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const englishTranslations = JSON.parse(jsonText);
    console.log(`  ✅ Translated to English`);

    return englishTranslations;
  } catch (error) {
    console.error(`  ❌ Error translating:`, error.message);
    return null;
  }
}

async function mergeTranslations(newTranslations, locale) {
  const filePath = path.join(__dirname, '..', 'messages', `${locale}.json`);
  const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Merge into dashboard namespace
  if (!existing.dashboard) {
    existing.dashboard = {};
  }

  Object.assign(existing.dashboard, newTranslations);

  // Write back with formatting
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
  console.log(`  💾 Merged ${Object.keys(newTranslations).length} keys into ${locale}.json`);
}

async function main() {
  console.log('🚀 Starting Gemini-powered translation extraction...\n');

  const componentsDir = path.join(__dirname, '..', 'components', 'dashboard');
  const files = fs.readdirSync(componentsDir)
    .filter(f => f.endsWith('.tsx'))
    .map(f => path.join(componentsDir, f));

  console.log(`📁 Found ${files.length} component files\n`);

  // Collect all strings
  const allStrings = [];
  const fileMapping = {}; // Track which file each string came from

  for (const file of files) {
    const strings = await extractStringsFromComponent(file);

    if (strings.length > 0) {
      allStrings.push(...strings);

      // Store mapping
      strings.forEach(s => {
        if (!fileMapping[s.key]) {
          fileMapping[s.key] = [];
        }
        fileMapping[s.key].push({
          file: path.basename(file),
          german: s.german,
          context: s.context
        });
      });
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  if (allStrings.length === 0) {
    console.log('\n✅ No German strings found!');
    return;
  }

  console.log(`\n📝 Total strings extracted: ${allStrings.length}`);

  // Create German translations object
  const germanTranslations = {};
  allStrings.forEach(item => {
    germanTranslations[item.key] = item.german;
  });

  // Translate to English
  const englishTranslations = await translateToEnglish(allStrings);

  if (!englishTranslations) {
    console.log('❌ Translation to English failed');
    return;
  }

  // Save mapping file for reference
  const mappingFile = path.join(__dirname, '..', 'translation-mapping.json');
  fs.writeFileSync(mappingFile, JSON.stringify(fileMapping, null, 2), 'utf8');
  console.log(`\n💾 Saved translation mapping to: translation-mapping.json`);

  // Merge into translation files
  await mergeTranslations(germanTranslations, 'de');
  await mergeTranslations(englishTranslations, 'en');

  console.log('\n📊 Token Usage Summary:');
  console.log(`   Input tokens:  ${totalInputTokens.toLocaleString()}`);
  console.log(`   Output tokens: ${totalOutputTokens.toLocaleString()}`);
  console.log(`   Total tokens:  ${(totalInputTokens + totalOutputTokens).toLocaleString()}`);

  // Rough cost estimate for Gemini Flash
  const costPer1MInput = 0.075;
  const costPer1MOutput = 0.30;
  const estimatedCost = (totalInputTokens / 1000000 * costPer1MInput) +
                        (totalOutputTokens / 1000000 * costPer1MOutput);
  console.log(`   Estimated cost: $${estimatedCost.toFixed(4)}`);

  console.log('\n✅ Translation extraction complete!');
  console.log('📝 Next step: Run apply-translations.js to update component files');
}

main()
  .catch(console.error);
