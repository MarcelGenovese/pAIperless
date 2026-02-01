#!/usr/bin/env node
/**
 * Comprehensive German string extraction
 * Finds ALL German text: JSX, toast calls, attributes, etc.
 */

const fs = require('fs');
const path = require('path');

// German indicators
const germanIndicators = ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'];
const germanWords = /\b(und|oder|mit|von|für|der|die|das|ein|eine|ist|sind|werden|wird|wurde|nicht|auf|zu|im|am|über|unter|bei|nach|vor|zwischen|können|müssen|sollen|wollen|Fehler|Warnung|Erfolg|erfolgreich|fehlgeschlagen|gespeichert|gelöscht|aktualisiert|gesendet|empfangen|aktiviert|deaktiviert|übersprungen|kopiert|gestartet|gestoppt|pausiert|fortgesetzt|hinzugefügt|entfernt|erstellt|bearbeitet|verfügbar|läuft|wird|konnte|muss)\b/;

function isGermanText(text) {
  // Skip identifiers and constants
  if (text.match(/^[a-z][a-zA-Z0-9_]*$/)) return false;
  if (text.match(/^[A-Z_]+$/)) return false;
  if (text.match(/^[\$\{\}\[\]0-9\.,;:\(\)\-\+\*\/\=\<\>\!]+$/)) return false;
  if (text.length < 3) return false;

  // Must have German characters or German words
  return germanIndicators.some(char => text.includes(char)) || germanWords.test(text);
}

function extractFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const strings = new Map(); // Map to store string -> locations

  function addString(text, line) {
    const trimmed = text.trim();
    if (isGermanText(trimmed)) {
      if (!strings.has(trimmed)) {
        strings.set(trimmed, []);
      }
      strings.get(trimmed).push(line);
    }
  }

  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // Pattern 1: JSX text content >text<
    const jsxMatches = line.matchAll(/>([^<>{}]+)</g);
    for (const match of jsxMatches) {
      addString(match[1], lineNum);
    }

    // Pattern 2: String attributes (placeholder, title, etc.)
    const attrMatches = line.matchAll(/(?:placeholder|label|title|description|alt|value|className)=['"]([^'"]+)['"]/g);
    for (const match of attrMatches) {
      addString(match[1], lineNum);
    }

    // Pattern 3: Toast/function calls with title/description
    const toastMatches = line.matchAll(/(?:title|description):\s*['"]([^'"]+)['"]/g);
    for (const match of toastMatches) {
      addString(match[1], lineNum);
    }

    // Pattern 4: Template literals in JSX {`text`}
    const templateMatches = line.matchAll(/\{`([^`]+)`\}/g);
    for (const match of templateMatches) {
      addString(match[1], lineNum);
    }

    // Pattern 5: String literals in JSX {text}
    const literalMatches = line.matchAll(/\{['"]([^'"]+)['"]\}/g);
    for (const match of literalMatches) {
      addString(match[1], lineNum);
    }

    // Pattern 6: Direct string assignments
    const assignMatches = line.matchAll(/=\s*['"]([^'"]{4,})['"]/g);
    for (const match of assignMatches) {
      addString(match[1], lineNum);
    }
  });

  return strings;
}

// Files to process
const componentsToProcess = [
  'components/Footer.tsx',
  'components/Logo.tsx',
  'components/setup/Step3DocumentAI.tsx',
  'components/setup/Step4GoogleOAuth.tsx',
  'components/setup/Step5Email.tsx',
  'components/setup/Step6PaperlessIntegration.tsx',
  'components/setup/Step7Advanced.tsx',
  'components/setup/Step8FTP.tsx',
  'components/setup/Step9Complete.tsx',
  'components/setup/WelcomeScreen.tsx',
  'components/dashboard/AdvancedSettingsTab.tsx',
  'components/dashboard/AnalyzeTab.tsx',
  'components/dashboard/DocumentsTab.tsx',
  'components/dashboard/DocumentUpload.tsx',
  'components/dashboard/EmailSettingsCard.tsx',
  'components/dashboard/EmergencyStopButton.tsx',
  'components/dashboard/FolderContents.tsx',
  'components/dashboard/FTPSettingsCard.tsx',
  'components/dashboard/GoogleSettingsTab.tsx',
  'components/dashboard/LogsTab.tsx',
  'components/dashboard/OverviewTab.tsx',
  'components/dashboard/PaperlessSettingsTab.tsx',
  'components/dashboard/PipelineTestTab.tsx',
  'components/dashboard/PollingCounter.tsx',
  'components/dashboard/ProcessingStatusIndicator.tsx',
  'components/dashboard/QueueCards.tsx',
  'components/dashboard/Sidebar.tsx',
  'components/dashboard/SystemCheckModal.tsx',
  'components/dashboard/WebhookApiKeyDisplay.tsx',
  'components/dashboard/WebhookValidationWarning.tsx',
];

console.log('🔍 Extracting ALL German strings...\n');

const allStrings = new Map(); // string -> [{ file, lines }]
let totalCount = 0;

componentsToProcess.forEach(relPath => {
  const filePath = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${relPath}`);
    return;
  }

  const strings = extractFromFile(filePath);
  if (strings.size > 0) {
    console.log(`📄 ${path.basename(filePath)}: ${strings.size} German strings`);
    totalCount += strings.size;

    strings.forEach((lines, text) => {
      if (!allStrings.has(text)) {
        allStrings.set(text, []);
      }
      allStrings.get(text).push({
        file: relPath,
        lines: lines
      });
    });
  }
});

console.log(`\n✅ Total: ${totalCount} German strings found`);
console.log(`📊 Unique strings: ${allStrings.size}\n`);

// Save results
const outputFile = path.join(__dirname, 'all-german-strings.json');
const output = {
  totalCount,
  uniqueCount: allStrings.size,
  strings: Array.from(allStrings.entries()).map(([text, occurrences]) => ({
    text,
    occurrences
  }))
};

fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
console.log(`💾 Saved to: ${outputFile}`);
console.log(`\n📋 Next steps:`);
console.log(`   1. Review the extracted strings`);
console.log(`   2. Generate translation keys`);
console.log(`   3. Run AI improvement on English translations`);
console.log(`   4. Update components with t() calls`);
