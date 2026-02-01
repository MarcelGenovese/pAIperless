#!/usr/bin/env node
/**
 * Complete i18n for remaining components
 * Extracts, translates, and updates in one go
 */

const fs = require('fs');
const path = require('path');

const MESSAGES_DE = path.join(__dirname, '../messages/de.json');
const MESSAGES_EN = path.join(__dirname, '../messages/en.json');

// Components to process
const componentsToProcess = [
  'components/Footer.tsx',
  'components/Logo.tsx',
  'components/setup/Step4GoogleOAuth.tsx',
  'components/setup/WelcomeScreen.tsx',
  'components/setup/Step7Advanced.tsx',
  'components/setup/Step9Complete.tsx',
  'components/setup/Step3DocumentAI.tsx',
  'components/dashboard/WebhookValidationWarning.tsx',
  'components/dashboard/Sidebar.tsx',
  'components/dashboard/WebhookApiKeyDisplay.tsx',
  'components/dashboard/ProcessingStatusIndicator.tsx',
  'components/dashboard/PollingCounter.tsx',
  'components/dashboard/DocumentUpload.tsx',
  'components/dashboard/SystemCheckModal.tsx',
];

// German indicators
const germanIndicators = ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'];

function isGermanText(text) {
  if (text.match(/^[a-z][a-zA-Z0-9_]*$/)) return false;
  if (text.match(/^[A-Z_]+$/)) return false;
  if (text.match(/^\$|^{|^}|^[0-9]+$/)) return false;
  if (text.length < 3) return false;

  return germanIndicators.some(char => text.includes(char)) ||
         text.match(/\b(und|oder|mit|von|für|der|die|das|ein|eine|ist|werden|wird|nicht|auf|zu|im|am)\b/);
}

function extractStringsFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const strings = new Set();

  // Pattern 1: JSX text content
  const jsxTextRegex = />([^<>{}\n]+)</g;
  let match;
  while ((match = jsxTextRegex.exec(content)) !== null) {
    const text = match[1].trim();
    if (isGermanText(text)) {
      strings.add(text);
    }
  }

  // Pattern 2: String attributes
  const attrRegex = /(?:placeholder|label|title|description|alt|value)=["']([^"']+)["']/g;
  while ((match = attrRegex.exec(content)) !== null) {
    const text = match[1].trim();
    if (isGermanText(text)) {
      strings.add(text);
    }
  }

  // Pattern 3: Template literals in JSX
  const templateRegex = /\{`([^`]+)`\}/g;
  while ((match = templateRegex.exec(content)) !== null) {
    const text = match[1].trim();
    if (isGermanText(text)) {
      strings.add(text);
    }
  }

  return Array.from(strings);
}

function generateKey(text) {
  let key = text
    .toLowerCase()
    .replace(/[äöüß]/g, char => {
      const map = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
      return map[char] || char;
    })
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50);

  return key || 'unknown';
}

// Main execution
console.log('🔄 Processing remaining components...\n');

const messagesDE = JSON.parse(fs.readFileSync(MESSAGES_DE, 'utf8'));
const messagesEN = JSON.parse(fs.readFileSync(MESSAGES_EN, 'utf8'));

const allStrings = [];
let totalStrings = 0;

// Extract from all components
componentsToProcess.forEach(relPath => {
  const filePath = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${relPath}`);
    return;
  }

  const strings = extractStringsFromFile(filePath);
  if (strings.length > 0) {
    const componentName = path.basename(filePath, '.tsx');
    console.log(`📄 ${componentName}: ${strings.length} strings`);
    totalStrings += strings.length;

    allStrings.push({
      file: relPath,
      component: componentName,
      strings
    });
  }
});

console.log(`\n✅ Total: ${totalStrings} German strings found\n`);

if (totalStrings === 0) {
  console.log('🎉 All components already translated!');
  process.exit(0);
}

// Add to translation files
console.log('📝 Adding to translation files...\n');

let newKeysDE = 0;
let newKeysEN = 0;

// Initialize categories if missing
if (!messagesDE.components) messagesDE.components = {};
if (!messagesEN.components) messagesEN.components = {};

allStrings.forEach(({ component, strings }) => {
  strings.forEach(germanText => {
    const key = generateKey(germanText);

    // Determine category
    let category = 'components';
    if (component.includes('Step')) {
      category = 'setup';
    } else if (component.toLowerCase().includes('settings') || component.includes('Sidebar')) {
      category = 'settings';
    } else if (component.includes('Tab') || component.includes('Card') || component.includes('Dashboard')) {
      category = 'dashboard';
    }

    // Ensure category exists
    if (!messagesDE[category]) messagesDE[category] = {};
    if (!messagesEN[category]) messagesEN[category] = {};

    // Add if not exists
    if (!messagesDE[category][key]) {
      messagesDE[category][key] = germanText;
      newKeysDE++;
      console.log(`  ✅ DE: ${category}.${key} = "${germanText.substring(0, 50)}${germanText.length > 50 ? '...' : ''}"`);
    }

    if (!messagesEN[category][key]) {
      // Simple placeholder for now
      messagesEN[category][key] = `[TODO: ${germanText}]`;
      newKeysEN++;
    }
  });
});

// Save translations
fs.writeFileSync(MESSAGES_DE, JSON.stringify(messagesDE, null, 2));
fs.writeFileSync(MESSAGES_EN, JSON.stringify(messagesEN, null, 2));

console.log(`\n✅ Added ${newKeysDE} new German keys`);
console.log(`✅ Added ${newKeysEN} new English placeholders`);

// Save extraction results for AI improvement
fs.writeFileSync(
  path.join(__dirname, 'remaining-i18n-strings.json'),
  JSON.stringify(allStrings, null, 2)
);

console.log(`\n📋 Next steps:`);
console.log(`   1. Run: node scripts/improve-translations-with-ai.js --api-key "YOUR_KEY"`);
console.log(`   2. Review improved translations`);
console.log(`   3. Run: node scripts/update-remaining-components.js`);
console.log(`   4. Test the application`);
