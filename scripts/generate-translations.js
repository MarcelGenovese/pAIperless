#!/usr/bin/env node
/**
 * Generate translation entries from extracted strings
 * Uses simple dictionary for German->English translation (NO API costs!)
 */

const fs = require('fs');
const path = require('path');

const EXTRACTION_FILE = path.join(__dirname, 'i18n-extraction-results.json');
const MESSAGES_DE = path.join(__dirname, '../messages/de.json');
const MESSAGES_EN = path.join(__dirname, '../messages/en.json');

// Simple German->English dictionary (most common words)
const dictionary = {
  'dokument': 'document',
  'dokumente': 'documents',
  'datei': 'file',
  'dateien': 'files',
  'verarbeiten': 'process',
  'verarbeitung': 'processing',
  'löschen': 'delete',
  'speichern': 'save',
  'laden': 'load',
  'fehler': 'error',
  'erfolg': 'success',
  'abbrechen': 'cancel',
  'weiter': 'next',
  'zurück': 'back',
  'einstellungen': 'settings',
  'erweitert': 'advanced',
  'sprache': 'language',
  'auswählen': 'select',
  'tag': 'tag',
  'tags': 'tags',
  'feld': 'field',
  'felder': 'fields',
  'beschreibung': 'description',
  'datum': 'date',
  'aktion': 'action',
  'aktionen': 'actions',
  'erforderlich': 'required',
  'optional': 'optional',
  'alle': 'all',
  'öffnen': 'open',
  'schließen': 'close',
  'und': 'and',
  'oder': 'or',
  'für': 'for',
  'von': 'from',
  'mit': 'with',
  'ohne': 'without',
  'vollständig': 'complete',
  'komplett': 'complete',
  'neu': 'new',
  'alt': 'old',
  'ändern': 'change',
  'anzeigen': 'display',
  'details': 'details',
  'wizard': 'wizard',
  'setup': 'setup',
  'ausführen': 'execute',
  'erneut': 'again',
  'zwischen': 'between',
  'hell': 'light',
  'dunkel': 'dark',
  'design': 'theme',
  'diagnose': 'diagnostics',
  'technisch': 'technical',
  'prompt': 'prompt',
  'vorschau': 'preview'
};

function generateKey(text, component) {
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

function simpleTranslate(germanText) {
  let english = germanText.toLowerCase();

  // Replace German characters
  english = english
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');

  // Apply dictionary
  Object.entries(dictionary).forEach(([de, en]) => {
    const regex = new RegExp(`\\b${de}\\b`, 'gi');
    english = english.replace(regex, en);
  });

  // Capitalize first letter
  return english.charAt(0).toUpperCase() + english.slice(1);
}

// Load existing translations
const messagesDE = JSON.parse(fs.readFileSync(MESSAGES_DE, 'utf8'));
const messagesEN = JSON.parse(fs.readFileSync(MESSAGES_EN, 'utf8'));

// Load extraction results
const extractionResults = JSON.parse(fs.readFileSync(EXTRACTION_FILE, 'utf8'));

// Group by component category
const componentCategories = {
  dashboard: messagesDE.dashboard || {},
  settings: messagesDE.settings || {},
  setup: messagesDE.setup || {},
  components: {}
};

console.log('🔧 Generating translations...\n');

let newEntriesDE = 0;
let newEntriesEN = 0;

extractionResults.forEach(({ component, strings }) => {
  console.log(`\n📄 Processing ${component}...`);

  strings.forEach(germanText => {
    const key = generateKey(germanText, component);
    const englishText = simpleTranslate(germanText);

    // Determine category
    let category = 'components';
    if (component.includes('Tab') || component.includes('Card')) {
      category = 'dashboard';
    } else if (component.includes('Step')) {
      category = 'setup';
    } else if (component.includes('Settings')) {
      category = 'settings';
    }

    // Add to appropriate category
    if (!componentCategories[category][key]) {
      componentCategories[category][key] = germanText;
      newEntriesDE++;
      console.log(`  ✅ DE: ${key} = "${germanText}"`);
    }

    if (!messagesEN[category] || !messagesEN[category][key]) {
      if (!messagesEN[category]) messagesEN[category] = {};
      messagesEN[category][key] = englishText;
      newEntriesEN++;
      console.log(`  ✅ EN: ${key} = "${englishText}"`);
    }
  });
});

// Merge back into messages
Object.entries(componentCategories).forEach(([category, entries]) => {
  messagesDE[category] = { ...messagesDE[category], ...entries };
  messagesEN[category] = { ...messagesEN[category], ...entries };
});

// Save updated translations
fs.writeFileSync(MESSAGES_DE, JSON.stringify(messagesDE, null, 2));
fs.writeFileSync(MESSAGES_EN, JSON.stringify(messagesEN, null, 2));

console.log(`\n✅ Added ${newEntriesDE} new German entries`);
console.log(`✅ Added ${newEntriesEN} new English entries`);
console.log(`\n💾 Translations saved to:`);
console.log(`  - ${MESSAGES_DE}`);
console.log(`  - ${MESSAGES_EN}`);
console.log(`\n⚠️  Note: English translations are auto-generated. Please review and improve them!`);
