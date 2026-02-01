#!/usr/bin/env node
/**
 * Update components by replacing German strings with t() calls
 * Uses the translation key mapping generated earlier
 */

const fs = require('fs');
const path = require('path');

const KEY_MAP_FILE = path.join(__dirname, 'translation-key-map.json');
const EXTRACTION_FILE = path.join(__dirname, 'all-german-strings.json');

// Load key mapping and extraction data
const keyMap = JSON.parse(fs.readFileSync(KEY_MAP_FILE, 'utf8'));
const extraction = JSON.parse(fs.readFileSync(EXTRACTION_FILE, 'utf8'));

console.log('🔄 Updating components with t() calls...\n');

// Group strings by file
const fileUpdates = new Map();
extraction.strings.forEach(({ text, occurrences }) => {
  occurrences.forEach(({ file, lines }) => {
    if (!fileUpdates.has(file)) {
      fileUpdates.set(file, []);
    }
    fileUpdates.get(file).push({
      text,
      lines,
      key: keyMap[text]
    });
  });
});

let totalFiles = 0;
let totalReplacements = 0;

// Process each file
fileUpdates.forEach((updates, relPath) => {
  const filePath = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${relPath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Check if useTranslations already imported
  const hasUseTranslations = content.includes("from 'next-intl'");
  let needsImport = !hasUseTranslations;

  // Group by category to determine which t() to use
  const categories = new Set();
  updates.forEach(({ key }) => {
    categories.add(key.category);
  });

  // Sort updates by text length (longest first) to avoid partial replacements
  updates.sort((a, b) => b.text.length - a.text.length);

  let replacements = 0;

  // Replace each German string with t() call
  updates.forEach(({ text, key }) => {
    const category = key.category;
    const translationKey = key.key;

    // Escape special regex characters in the German text
    const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Pattern 1: JSX text content >text<
    const jsxRegex = new RegExp(`>\\s*${escapedText}\\s*<`, 'g');
    const jsxReplacement = `>{t('${translationKey}')}<`;
    if (content.match(jsxRegex)) {
      content = content.replace(jsxRegex, jsxReplacement);
      replacements++;
    }

    // Pattern 2: String in JSX attribute or object property
    const stringRegex = new RegExp(`(['"\`])${escapedText}\\1`, 'g');
    const stringReplacement = `{t('${translationKey}')}`;

    // For toast() calls and similar, keep the quotes
    const quotedRegex = new RegExp(`(title|description|placeholder|alt|label):\\s*(['"\`])${escapedText}\\2`, 'g');
    const quotedReplacement = `$1: t('${translationKey}')`;

    if (content.match(quotedRegex)) {
      content = content.replace(quotedRegex, quotedReplacement);
      replacements++;
    } else if (content.match(stringRegex)) {
      // For JSX attributes, replace with {t()}
      const attrRegex = new RegExp(`(title|description|placeholder|alt|label)=(['"\`])${escapedText}\\2`, 'g');
      const attrReplacement = `$1={t('${translationKey}')}`;

      if (content.match(attrRegex)) {
        content = content.replace(attrRegex, attrReplacement);
        replacements++;
      }
    }
  });

  // Add import and hook if needed
  if (needsImport && replacements > 0) {
    // Find a good place to add the import (after other imports)
    const importMatch = content.match(/import[^;]+;/g);
    if (importMatch) {
      const lastImport = importMatch[importMatch.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);
      const insertIndex = lastImportIndex + lastImport.length;
      content = content.slice(0, insertIndex) +
                "\nimport { useTranslations } from 'next-intl';" +
                content.slice(insertIndex);
    }

    // Add useTranslations hook at the start of the component
    // Find the component function
    const componentMatch = content.match(/export default function \w+\([^)]*\)\s*{/);
    if (componentMatch) {
      const funcStart = componentMatch.index + componentMatch[0].length;

      // Determine which category to use for t()
      const primaryCategory = categories.size === 1 ?
        Array.from(categories)[0] :
        (relPath.includes('/setup/') ? 'setup' : 'dashboard');

      // Check if there's already a t() hook
      const hookMatch = content.match(/const\s+t\s*=\s*useTranslations/);
      if (!hookMatch) {
        content = content.slice(0, funcStart) +
                  `\n  const t = useTranslations('${primaryCategory}');\n` +
                  content.slice(funcStart);
      }
    }
  }

  // Only write if changes were made
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ ${path.basename(filePath)}: ${replacements} replacements`);
    totalFiles++;
    totalReplacements += replacements;
  }
});

console.log(`\n✅ Updated ${totalFiles} files`);
console.log(`✅ Total replacements: ${totalReplacements}`);
console.log(`\n📋 Next steps:`);
console.log(`   1. Review the changes with: git diff`);
console.log(`   2. Test the application: npm run dev`);
console.log(`   3. Commit changes: git add . && git commit -m "feat: Complete i18n implementation"`);
