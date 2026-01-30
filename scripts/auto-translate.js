#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Automatic i18n Translation Script
 *
 * Automatically replaces German hardcoded strings in components with translation calls
 */

// Load translation files
const dePath = path.join(__dirname, '../messages/de.json');
const deTranslations = JSON.parse(fs.readFileSync(dePath, 'utf8'));

// Build flat mapping: German text -> translation key path
const translationMap = new Map();

function flattenTranslations(obj, prefix = '') {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      // Store: German text -> {namespace, key}
      const namespace = prefix.split('.')[0] || 'common';
      const keyPath = prefix ? fullKey.substring(prefix.split('.')[0].length + 1) : key;

      translationMap.set(value, {
        namespace,
        key: keyPath,
        fullKey
      });
    } else if (typeof value === 'object' && value !== null) {
      flattenTranslations(value, fullKey);
    }
  }
}

flattenTranslations(deTranslations);

console.log(`Loaded ${translationMap.size} translations from de.json`);

// Keywords and patterns to NEVER translate
const SKIP_PATTERNS = [
  /^import /,
  /^export /,
  /^const /,
  /^let /,
  /^var /,
  /^function /,
  /^class /,
  /^interface /,
  /^type /,
  /^enum /,
  /^\/\//,  // Comments
  /^\/\*/,  // Multi-line comments
  /^\s*\*/,  // Comment continuation
  /^https?:\/\//,  // URLs
  /^\/api\//,  // API paths
  /^@\//,  // Import aliases
  /^\.\.\//,  // Relative imports
  /^\.\//,  // Relative imports
];

// File extensions to process
const EXTENSIONS = ['.tsx', '.ts'];

// Directories to process
const DIRS_TO_PROCESS = [
  path.join(__dirname, '../components'),
  path.join(__dirname, '../app'),
];

// Find all relevant files
function findFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;

  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules, .next, etc.
      if (!file.startsWith('.') && file !== 'node_modules') {
        findFiles(filePath, fileList);
      }
    } else if (EXTENSIONS.includes(path.extname(file))) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Check if string should be skipped
function shouldSkipString(str, context) {
  // Skip empty or very short strings
  if (!str || str.length < 2) return true;

  // Skip if matches skip patterns
  if (SKIP_PATTERNS.some(pattern => pattern.test(str))) return true;

  // Skip single characters
  if (str.length === 1) return true;

  // Skip numbers only
  if (/^\d+$/.test(str)) return true;

  // Skip CSS classes
  if (str.includes('-') && str.split('-').length > 2) return true;

  // Skip file paths
  if (str.includes('/') || str.includes('\\')) return true;

  // Skip environment variables
  if (str.startsWith('$') || str.startsWith('process.env')) return true;

  // Skip if it looks like code
  if (str.includes('(') || str.includes(')') || str.includes('{') || str.includes('}')) return true;

  return false;
}

// Process a single file
function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Track which namespaces are needed
  const usedNamespaces = new Set();
  let replacementCount = 0;

  // Find all string literals (both single and double quotes)
  // This is a simplified approach - real parser would be better but more complex
  const stringPattern = /(['"])(?:(?=(\\?))\2.)*?\1/g;

  const replacements = [];
  let match;

  while ((match = stringPattern.exec(content)) !== null) {
    const fullMatch = match[0];
    const quote = match[1];
    const stringContent = fullMatch.slice(1, -1); // Remove quotes

    // Skip if should be ignored
    if (shouldSkipString(stringContent, content.substring(Math.max(0, match.index - 100), match.index))) {
      continue;
    }

    // Check if we have a translation for this
    const translation = translationMap.get(stringContent);

    if (translation) {
      // Check context to determine if it's in JSX or not
      const beforeMatch = content.substring(Math.max(0, match.index - 5), match.index);
      const afterMatch = content.substring(match.index + fullMatch.length, Math.min(content.length, match.index + fullMatch.length + 5));

      const isInJSX = beforeMatch.includes('>') || afterMatch.includes('<') || beforeMatch.includes('=');

      let replacement;
      const tVar = translation.namespace === 'common' ? 'tCommon' : 't';

      if (isInJSX) {
        replacement = `{${tVar}('${translation.key}')}`;
      } else {
        replacement = `${tVar}('${translation.key}')`;
      }

      replacements.push({
        original: fullMatch,
        replacement,
        index: match.index,
        namespace: translation.namespace
      });

      usedNamespaces.add(translation.namespace);
      replacementCount++;
    }
  }

  // Apply replacements (in reverse order to maintain indices)
  replacements.sort((a, b) => b.index - a.index);

  for (const repl of replacements) {
    content = content.substring(0, repl.index) + repl.replacement + content.substring(repl.index + repl.original.length);
  }

  // Add imports if we made replacements
  if (replacementCount > 0) {
    // Check if already has "use client" directive
    const hasUseClient = content.includes('"use client"') || content.includes("'use client'");

    // Check if already has useTranslations import
    const hasTranslationsImport = content.includes('useTranslations');

    if (!hasTranslationsImport) {
      // Find the first import statement
      const firstImportMatch = /^import /m.exec(content);

      if (firstImportMatch) {
        const insertPos = firstImportMatch.index;
        const importStatement = "import { useTranslations } from 'next-intl';\n";
        content = content.substring(0, insertPos) + importStatement + content.substring(insertPos);
      } else if (hasUseClient) {
        // Insert after "use client"
        const useClientMatch = /(["']use client["'];?\n)/;
        content = content.replace(useClientMatch, `$1\nimport { useTranslations } from 'next-intl';\n`);
      }
    }

    // Add translation hooks at the start of the component/function
    // Find the function/component declaration
    const componentMatch = /export default function (\w+)\(\) \{/;
    const componentNameMatch = componentMatch.exec(content);

    if (componentNameMatch) {
      const componentStart = componentNameMatch.index + componentNameMatch[0].length;

      let hookStatements = [];

      // Check if hooks already exist
      if (!content.includes('useTranslations(')) {
        if (usedNamespaces.has('common')) {
          hookStatements.push("  const tCommon = useTranslations('common');");
        }

        // Add main namespace hook (usually the first non-common one)
        const mainNamespace = Array.from(usedNamespaces).find(ns => ns !== 'common');
        if (mainNamespace) {
          hookStatements.push(`  const t = useTranslations('${mainNamespace}');`);
        }

        if (hookStatements.length > 0) {
          content = content.substring(0, componentStart) + '\n' + hookStatements.join('\n') + '\n' + content.substring(componentStart);
        }
      }
    }
  }

  // Only write if changed
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ ${path.relative(process.cwd(), filePath)}: ${replacementCount} replacements`);
    return replacementCount;
  }

  return 0;
}

// Main execution
console.log('\n🔄 Starting automatic translation...\n');

let totalReplacements = 0;
let filesProcessed = 0;
let filesChanged = 0;

DIRS_TO_PROCESS.forEach(dir => {
  const files = findFiles(dir);
  console.log(`Found ${files.length} files in ${path.relative(process.cwd(), dir)}`);

  files.forEach(file => {
    filesProcessed++;
    const count = processFile(file);
    if (count > 0) {
      filesChanged++;
      totalReplacements += count;
    }
  });
});

console.log('\n✅ Translation complete!');
console.log(`   Files processed: ${filesProcessed}`);
console.log(`   Files changed: ${filesChanged}`);
console.log(`   Total replacements: ${totalReplacements}`);
console.log('\n⚠️  Please review the changes and test thoroughly!\n');
