#!/usr/bin/env node
/**
 * Extract hardcoded German strings from React components
 * and generate translation keys automatically
 *
 * NO AI/API costs - pure regex and logic!
 */

const fs = require('fs');
const path = require('path');

const COMPONENTS_DIR = path.join(__dirname, '../components');
const MESSAGES_DE = path.join(__dirname, '../messages/de.json');
const MESSAGES_EN = path.join(__dirname, '../messages/en.json');

// Patterns to find German strings in JSX
const patterns = [
  // Text in JSX: <div>Text here</div>
  />([^<>{}\n]+)</g,
  // Text in attributes: placeholder="Text"
  /(?:placeholder|label|title|description|alt)=["']([^"']+)["']/g,
  // Text in template literals in JSX: {`Text ${var}`}
  /\{`([^`]*)`\}/g,
];

// Words that indicate German text (simple heuristic)
const germanIndicators = ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'];

function isGermanText(text) {
  // Skip if it's code/variable
  if (text.match(/^[a-z][a-zA-Z0-9_]*$/)) return false;
  if (text.match(/^[A-Z_]+$/)) return false;
  if (text.match(/^\$|^{|^}/)) return false;

  // Check for German characters
  return germanIndicators.some(char => text.includes(char)) ||
         // Or common German words
         text.match(/\b(und|oder|mit|von|für|der|die|das|ein|eine)\b/);
}

function generateKey(text, component) {
  // Generate translation key from text
  // e.g., "Dokumente verarbeiten" -> "documentsProcess"
  let key = text
    .toLowerCase()
    .replace(/[äöüß]/g, char => {
      const map = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
      return map[char] || char;
    })
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((word, i) => i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  return key || 'unknownKey';
}

function extractStringsFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const componentName = path.basename(filePath, '.tsx');
  const strings = new Set();

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const text = match[1].trim();
      if (text.length > 2 && isGermanText(text)) {
        strings.add(text);
      }
    }
  });

  return {
    component: componentName,
    strings: Array.from(strings)
  };
}

function scanDirectory(dir) {
  const results = [];

  function scan(currentDir) {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (item.endsWith('.tsx') && !item.endsWith('.test.tsx')) {
        const extracted = extractStringsFromFile(fullPath);
        if (extracted.strings.length > 0) {
          results.push(extracted);
        }
      }
    }
  }

  scan(dir);
  return results;
}

// Main execution
console.log('🔍 Scanning components for German strings...\n');
const results = scanDirectory(COMPONENTS_DIR);

console.log(`Found ${results.length} components with German strings:\n`);

let totalStrings = 0;
results.forEach(({ component, strings }) => {
  console.log(`📄 ${component}: ${strings.length} strings`);
  totalStrings += strings.length;
});

console.log(`\n✅ Total: ${totalStrings} German strings found`);
console.log('\n📝 Sample strings:');
results.slice(0, 3).forEach(({ component, strings }) => {
  console.log(`\n${component}:`);
  strings.slice(0, 5).forEach(str => console.log(`  - "${str}"`));
});

// Save results for manual review
const outputPath = path.join(__dirname, 'i18n-extraction-results.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`\n💾 Full results saved to: ${outputPath}`);
