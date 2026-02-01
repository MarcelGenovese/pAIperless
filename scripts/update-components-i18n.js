#!/usr/bin/env node
/**
 * Automatically update React components to use i18n translations
 * Replaces hardcoded German strings with t('key') calls
 */

const fs = require('fs');
const path = require('path');

const EXTRACTION_FILE = path.join(__dirname, 'i18n-extraction-results.json');
const MESSAGES_DE = path.join(__dirname, '../messages/de.json');

// Generate translation key from German text
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

  return key;
}

// Find the translation key for a German string
function findTranslationKey(germanText, messagesDE) {
  const possibleKey = generateKey(germanText);

  // Search through all categories
  for (const [category, entries] of Object.entries(messagesDE)) {
    if (typeof entries === 'object') {
      for (const [key, value] of Object.entries(entries)) {
        if (value === germanText || key === possibleKey) {
          return `${category}.${key}`;
        }
      }
    }
  }

  return null;
}

// Escape special regex characters
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Update a single component file
function updateComponentFile(filePath, stringsToReplace, messagesDE) {
  let content = fs.readFileSync(filePath, 'utf8');
  const componentName = path.basename(filePath, '.tsx');

  console.log(`\n📝 Updating ${componentName}...`);

  // Check if already uses translations
  if (content.includes('useTranslations')) {
    console.log('   ⚠️  Already uses useTranslations, skipping import');
  } else {
    // Add import at top (after existing imports)
    const importStatement = "import { useTranslations } from 'next-intl';\n";

    // Find the last import statement
    const lines = content.split('\n');
    let lastImportIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportIndex = i;
      }
    }

    if (lastImportIndex !== -1) {
      lines.splice(lastImportIndex + 1, 0, importStatement);
      content = lines.join('\n');
      console.log('   ✅ Added useTranslations import');
    }
  }

  // Add t() hook initialization in component function
  if (!content.includes('const t = useTranslations')) {
    // Find component function declaration
    const functionMatch = content.match(/export default function \w+\([^)]*\)\s*\{/);
    if (functionMatch) {
      const insertPos = functionMatch.index + functionMatch[0].length;

      // Determine category based on component name
      let category = 'dashboard';
      if (componentName.includes('Step')) {
        category = 'setup';
      } else if (componentName.toLowerCase().includes('settings')) {
        category = 'settings';
      }

      content = content.slice(0, insertPos) +
                `\n  const t = useTranslations('${category}');\n` +
                content.slice(insertPos);
      console.log(`   ✅ Added const t = useTranslations('${category}')`);
    }
  }

  let replacements = 0;

  // Replace strings
  stringsToReplace.forEach(germanText => {
    const key = findTranslationKey(germanText, messagesDE);

    if (!key) {
      console.log(`   ⚠️  No translation key found for: "${germanText.substring(0, 40)}..."`);
      return;
    }

    // Extract just the key part (without category prefix)
    const keyPart = key.split('.').slice(1).join('.');

    // Pattern 1: Text in JSX: >Text<
    const pattern1 = new RegExp(`>\\s*${escapeRegex(germanText)}\\s*<`, 'g');
    const newContent1 = content.replace(pattern1, `>{t('${keyPart}')}<`);
    if (newContent1 !== content) {
      content = newContent1;
      replacements++;
      console.log(`   ✅ ${keyPart}`);
    }

    // Pattern 2: String attributes: ="Text"
    const pattern2 = new RegExp(`(placeholder|label|title|description|alt)=["']${escapeRegex(germanText)}["']`, 'g');
    const newContent2 = content.replace(pattern2, `$1={t('${keyPart}')}`);
    if (newContent2 !== content) {
      content = newContent2;
      replacements++;
      console.log(`   ✅ ${keyPart} (attribute)`);
    }

    // Pattern 3: Template literals: {`Text`}
    const pattern3 = new RegExp(`\\{\`${escapeRegex(germanText)}\`\\}`, 'g');
    const newContent3 = content.replace(pattern3, `{t('${keyPart}')}`);
    if (newContent3 !== content) {
      content = newContent3;
      replacements++;
      console.log(`   ✅ ${keyPart} (template)`);
    }
  });

  if (replacements > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`   📝 ${replacements} replacements made`);
  } else {
    console.log(`   ℹ️  No replacements needed`);
  }

  return replacements;
}

// Main execution
async function main() {
  console.log('🔧 Updating components to use i18n translations...\n');

  // Load data
  const extractionResults = JSON.parse(fs.readFileSync(EXTRACTION_FILE, 'utf8'));
  const messagesDE = JSON.parse(fs.readFileSync(MESSAGES_DE, 'utf8'));

  let totalReplacements = 0;
  let componentsUpdated = 0;

  // Process each component
  for (const { component, strings } of extractionResults) {
    const filePath = path.join(__dirname, '../components');

    // Find the actual file (could be in subdirectories)
    let componentPath = null;
    const searchDirs = [
      path.join(filePath, 'dashboard'),
      path.join(filePath, 'setup'),
      path.join(filePath, 'ui'),
      filePath
    ];

    for (const dir of searchDirs) {
      const testPath = path.join(dir, `${component}.tsx`);
      if (fs.existsSync(testPath)) {
        componentPath = testPath;
        break;
      }
    }

    if (!componentPath) {
      console.log(`⚠️  Component file not found: ${component}.tsx`);
      continue;
    }

    const replacements = updateComponentFile(componentPath, strings, messagesDE);
    if (replacements > 0) {
      componentsUpdated++;
      totalReplacements += replacements;
    }
  }

  console.log(`\n✅ Complete!`);
  console.log(`   Components updated: ${componentsUpdated}`);
  console.log(`   Total replacements: ${totalReplacements}`);
  console.log(`\n⚠️  IMPORTANT: Review the changes before committing!`);
  console.log(`   Some manual adjustments may be needed for complex cases.`);
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
