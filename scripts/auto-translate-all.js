#!/usr/bin/env node
/**
 * Automatically translate ALL German strings in dashboard components
 * This is a comprehensive, automated solution that:
 * 1. Finds all German strings using regex
 * 2. Generates translation keys
 * 3. Replaces in code with t() calls
 * 4. Updates translation files
 * 5. Translates to English with Gemini
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const apiKey = process.argv[2];
if (!apiKey) {
  console.error('Usage: node auto-translate-all.js YOUR_GEMINI_API_KEY');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
let totalInputTokens = 0;
let totalOutputTokens = 0;

// German indicators
const hasGermanChars = (text) => /[äöüßÄÖÜ]/.test(text);
const hasGermanWords = (text) => /\b(und|oder|für|von|mit|wird|wurde|können|müssen|sollen|wollen|Fehler|Warnung|Erfolg|erfolgreich|fehlgeschlagen|gespeichert|gelöscht|aktualisiert|gesendet|empfangen|aktiviert|deaktiviert|Tag|Feld|Dokument|Verarbeitung|erstellt|bearbeitet|verfügbar|läuft)\b/.test(text);

function isGermanString(text) {
  if (!text || text.length < 3) return false;
  // Skip identifiers, constants, URLs, paths
  if (text.match(/^[a-z][a-zA-Z0-9_]*$/)) return false;
  if (text.match(/^[A-Z_]+$/)) return false;
  if (text.includes('://') || text.includes('/.') || text.includes('api/')) return false;
  if (text.match(/^[\$\{\}\[\]0-9\.,;:\(\)\-\+\*\/\=\<\>\!]+$/)) return false;

  return hasGermanChars(text) || hasGermanWords(text);
}

function generateKey(text) {
  return text
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50);
}

function extractGermanStrings(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const strings = new Map();

  // Pattern 1: JSX text content >text<
  const jsxRegex = />([^<>{}]+)</g;
  let match;
  while ((match = jsxRegex.exec(content)) !== null) {
    const text = match[1].trim();
    if (isGermanString(text) && !strings.has(text)) {
      strings.set(text, generateKey(text));
    }
  }

  // Pattern 2: String literals in attributes (title, placeholder, etc.)
  const attrRegex = /(?:title|placeholder|description|label|alt|aria-label)=["']([^"']+)["']/g;
  while ((match = attrRegex.exec(content)) !== null) {
    const text = match[1].trim();
    if (isGermanString(text) && !strings.has(text)) {
      strings.set(text, generateKey(text));
    }
  }

  // Pattern 3: Strings in toast calls
  const toastRegex = /(?:title|description):\s*["']([^"']+)["']/g;
  while ((match = toastRegex.exec(content)) !== null) {
    const text = match[1].trim();
    if (isGermanString(text) && !strings.has(text)) {
      strings.set(text, generateKey(text));
    }
  }

  // Pattern 4: CardTitle, CardDescription content
  const cardRegex = /<Card(?:Title|Description)[^>]*>([^<]+)</g;
  while ((match = cardRegex.exec(content)) !== null) {
    const text = match[1].trim();
    if (isGermanString(text) && !strings.has(text)) {
      strings.set(text, generateKey(text));
    }
  }

  return strings;
}

function replaceStringsInFile(filePath, stringMap) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Check if file has useTranslations
  const hasUseTranslations = content.includes('useTranslations');
  if (!hasUseTranslations) {
    console.log(`  ⚠️  Skipping ${path.basename(filePath)} - no useTranslations hook`);
    return false;
  }

  // Replace each string
  for (const [germanText, key] of stringMap) {
    // Escape special regex characters
    const escaped = germanText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Replace in JSX content
    const jsxPattern = new RegExp(`>\\s*${escaped}\\s*<`, 'g');
    if (jsxPattern.test(content)) {
      content = content.replace(jsxPattern, `>{t('${key}')}<`);
      modified = true;
    }

    // Replace in attributes
    const attrPattern = new RegExp(`(title|placeholder|description|label)=["']${escaped}["']`, 'g');
    if (attrPattern.test(content)) {
      content = content.replace(attrPattern, `$1={t('${key}')}`);
      modified = true;
    }

    // Replace in toast calls
    const toastPattern = new RegExp(`(title|description):\\s*["']${escaped}["']`, 'g');
    if (toastPattern.test(content)) {
      content = content.replace(toastPattern, `$1: t('${key}')`);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
  }

  return modified;
}

async function translateToEnglish(germanMap) {
  console.log(`\n🔄 Translating ${germanMap.size} strings to English with Gemini...`);

  const germanObj = {};
  for (const [text, key] of germanMap) {
    germanObj[key] = text;
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4000
    }
  });

  const prompt = `Translate these German strings to English. Return ONLY a JSON object with the same keys but English values.

${JSON.stringify(germanObj, null, 2)}

Return ONLY the JSON object, no explanations, no markdown.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    if (response.usageMetadata) {
      const inputTokens = response.usageMetadata.promptTokenCount || 0;
      const outputTokens = response.usageMetadata.candidatesTokenCount || 0;
      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;
      console.log(`  📊 Tokens: ${inputTokens} in, ${outputTokens} out`);
    }

    // Extract JSON
    let jsonText = text.trim();
    if (jsonText.includes('```json')) {
      jsonText = jsonText.replace(/^.*?```json\s*/s, '').replace(/\s*```.*$/s, '');
    } else if (jsonText.includes('```')) {
      jsonText = jsonText.replace(/^.*?```\s*/s, '').replace(/\s*```.*$/s, '');
    }

    // Find first { and last }
    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      jsonText = jsonText.substring(firstBrace, lastBrace + 1);
    }

    const englishObj = JSON.parse(jsonText);
    console.log(`  ✅ Translated successfully`);

    return englishObj;
  } catch (error) {
    console.error(`  ❌ Translation failed:`, error.message);
    // Return simple English fallback
    const fallback = {};
    for (const [text, key] of germanMap) {
      fallback[key] = text; // Keep German as fallback
    }
    return fallback;
  }
}

function updateTranslationFiles(germanMap, englishObj) {
  // Update de.json
  const dePath = path.join(__dirname, '..', 'messages', 'de.json');
  const deData = JSON.parse(fs.readFileSync(dePath, 'utf8'));
  if (!deData.dashboard) deData.dashboard = {};

  for (const [text, key] of germanMap) {
    deData.dashboard[key] = text;
  }

  fs.writeFileSync(dePath, JSON.stringify(deData, null, 2) + '\n', 'utf8');
  console.log(`  💾 Updated de.json with ${germanMap.size} keys`);

  // Update en.json
  const enPath = path.join(__dirname, '..', 'messages', 'en.json');
  const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  if (!enData.dashboard) enData.dashboard = {};

  Object.assign(enData.dashboard, englishObj);

  fs.writeFileSync(enPath, JSON.stringify(enData, null, 2) + '\n', 'utf8');
  console.log(`  💾 Updated en.json with ${Object.keys(englishObj).length} keys`);
}

async function main() {
  console.log('🚀 Auto-translating all German strings...\n');

  const componentsDir = path.join(__dirname, '..', 'components', 'dashboard');
  const files = fs.readdirSync(componentsDir)
    .filter(f => f.endsWith('.tsx'))
    .map(f => path.join(componentsDir, f));

  const allStrings = new Map();
  let filesModified = 0;

  // Phase 1: Extract and replace
  console.log('📝 Phase 1: Extracting and replacing strings\n');
  for (const file of files) {
    console.log(`📄 ${path.basename(file)}`);

    const strings = extractGermanStrings(file);
    if (strings.size === 0) {
      console.log(`  ✓ No German strings found`);
      continue;
    }

    console.log(`  Found ${strings.size} German strings`);

    // Add to global map
    for (const [text, key] of strings) {
      allStrings.set(text, key);
    }

    // Replace in file
    const modified = replaceStringsInFile(file, strings);
    if (modified) {
      console.log(`  ✅ Modified file`);
      filesModified++;
    }
  }

  if (allStrings.size === 0) {
    console.log('\n✅ No German strings found!');
    return;
  }

  console.log(`\n📊 Total: ${allStrings.size} unique German strings`);
  console.log(`📝 Modified: ${filesModified} files\n`);

  // Phase 2: Translate to English
  console.log('🌍 Phase 2: Translating to English\n');
  const englishObj = await translateToEnglish(allStrings);

  // Phase 3: Update translation files
  console.log('\n📚 Phase 3: Updating translation files\n');
  updateTranslationFiles(allStrings, englishObj);

  console.log('\n📊 Token Usage Summary:');
  console.log(`   Input tokens:  ${totalInputTokens.toLocaleString()}`);
  console.log(`   Output tokens: ${totalOutputTokens.toLocaleString()}`);
  console.log(`   Total tokens:  ${(totalInputTokens + totalOutputTokens).toLocaleString()}`);

  const costPer1MInput = 0.075;
  const costPer1MOutput = 0.30;
  const estimatedCost = (totalInputTokens / 1000000 * costPer1MInput) +
                        (totalOutputTokens / 1000000 * costPer1MOutput);
  console.log(`   Estimated cost: $${estimatedCost.toFixed(4)}`);

  console.log('\n✅ Done! Now run:');
  console.log('   docker compose build paiperless');
  console.log('   docker compose restart paiperless');
}

main().catch(console.error);
