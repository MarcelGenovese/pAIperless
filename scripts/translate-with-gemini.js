#!/usr/bin/env node
/**
 * Use Gemini API to translate German strings in components
 * This script uses the project's configured Gemini API key
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
    throw new Error('Gemini API key not found. Usage: node translate-with-gemini.js YOUR_API_KEY');
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Use flash model for cost efficiency
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    generationConfig: {
      temperature: 0.1,
      topP: 1,
      topK: 1,
      maxOutputTokens: 8000,
    }
  });

  return model;
}

async function translateComponent(filePath) {
  console.log(`\n📄 Processing: ${filePath}`);

  const content = fs.readFileSync(filePath, 'utf8');
  const model = await getGeminiClient();

  const prompt = `You are a code translation assistant. Your task is to replace ALL German hardcoded strings in this React component with translation function calls.

RULES:
1. Find ALL German strings (text in JSX, toast messages, button labels, placeholders, etc.)
2. Replace each German string with {t('translation_key')}
3. Create a snake_case translation key for each string
4. Keep English strings and technical terms unchanged
5. Do NOT translate: variable names, import paths, className values, technical constants
6. Preserve ALL code formatting, indentation, and structure
7. Make sure the component already has: const t = useTranslations('dashboard'); or similar

GERMAN INDICATORS:
- Contains: ä, ö, ü, ß, Ä, Ö, Ü
- German words like: und, oder, für, von, mit, wird, wurde, können, müssen, etc.

OUTPUT FORMAT:
Return JSON with exactly this structure:
{
  "modifiedCode": "... complete file content with t() calls ...",
  "translations": {
    "translation_key": "German Text",
    "another_key": "Another German Text"
  }
}

Here's the component:

\`\`\`tsx
${content}
\`\`\`

Return ONLY valid JSON, no markdown, no explanations.`;

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

    // Parse JSON response
    let jsonText = text.trim();

    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonText);

    if (!parsed.modifiedCode || !parsed.translations) {
      throw new Error('Invalid response format from Gemini');
    }

    console.log(`  ✅ Found ${Object.keys(parsed.translations).length} strings to translate`);

    return parsed;
  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}:`, error.message);
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

async function translateEnglish(germanTranslations) {
  console.log(`\n🔄 Translating ${Object.keys(germanTranslations).length} strings to English...`);

  const model = await getGeminiClient();

  const prompt = `Translate these German strings to English. Return JSON with same keys but English values.

Input JSON:
${JSON.stringify(germanTranslations, null, 2)}

Return ONLY valid JSON with English translations, no markdown, no explanations.`;

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
    console.error(`  ❌ Error translating to English:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting Gemini-powered translation...\n');

  const componentsDir = path.join(__dirname, '..', 'components', 'dashboard');
  const files = fs.readdirSync(componentsDir)
    .filter(f => f.endsWith('.tsx'))
    .map(f => path.join(componentsDir, f));

  console.log(`📁 Found ${files.length} component files\n`);

  // Process one file at a time to avoid rate limits
  const allGermanTranslations = {};

  for (const file of files) {
    const result = await translateComponent(file);

    if (result) {
      // Write modified code back to file
      fs.writeFileSync(file, result.modifiedCode, 'utf8');
      console.log(`  💾 Updated ${path.basename(file)}`);

      // Collect translations
      Object.assign(allGermanTranslations, result.translations);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  if (Object.keys(allGermanTranslations).length === 0) {
    console.log('\n✅ No translations needed!');
    return;
  }

  console.log(`\n📝 Total translations collected: ${Object.keys(allGermanTranslations).length}`);

  // Translate to English
  const englishTranslations = await translateEnglish(allGermanTranslations);

  if (!englishTranslations) {
    console.log('❌ Failed to translate to English, skipping merge');
    return;
  }

  // Merge into translation files
  await mergeTranslations(allGermanTranslations, 'de');
  await mergeTranslations(englishTranslations, 'en');

  console.log('\n📊 Token Usage Summary:');
  console.log(`   Input tokens:  ${totalInputTokens.toLocaleString()}`);
  console.log(`   Output tokens: ${totalOutputTokens.toLocaleString()}`);
  console.log(`   Total tokens:  ${(totalInputTokens + totalOutputTokens).toLocaleString()}`);

  // Rough cost estimate for Gemini Flash
  const costPer1MInput = 0.075; // $0.075 per 1M input tokens
  const costPer1MOutput = 0.30; // $0.30 per 1M output tokens
  const estimatedCost = (totalInputTokens / 1000000 * costPer1MInput) +
                        (totalOutputTokens / 1000000 * costPer1MOutput);
  console.log(`   Estimated cost: $${estimatedCost.toFixed(4)}`);

  console.log('\n✅ Translation complete!');
  console.log('🔄 Run: docker compose build && docker compose restart paiperless');
}

main()
  .catch(console.error);
