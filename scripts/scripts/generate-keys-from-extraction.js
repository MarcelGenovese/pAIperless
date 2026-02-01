#!/usr/bin/env node
/**
 * Generate translation keys from extracted strings
 * Adds to de.json and en.json
 */

const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, 'all-german-strings.json');
const MESSAGES_DE = path.join(__dirname, '../messages/de.json');
const MESSAGES_EN = path.join(__dirname, '../messages/en.json');

function generateKey(text) {
  // Remove emojis and special characters
  let key = text
    .replace(/[🚨✅📝⚠️💾📋🔄🎉]/g, '')
    .trim()
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

function categorizeString(text, occurrences) {
  // Determine category based on where the string appears
  const files = occurrences.map(o => o.file).join(',');

  if (files.includes('setup/')) {
    return 'setup';
  } else if (files.includes('dashboard/')) {
    return 'dashboard';
  } else {
    return 'common';
  }
}

// Load input
const input = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
const messagesDE = JSON.parse(fs.readFileSync(MESSAGES_DE, 'utf8'));
const messagesEN = JSON.parse(fs.readFileSync(MESSAGES_EN, 'utf8'));

console.log('🔑 Generating translation keys...\n');

let newKeysDE = 0;
let newKeysEN = 0;
const keyMap = {}; // Map German text -> key for component update

input.strings.forEach(({ text, occurrences }) => {
  const key = generateKey(text);
  const category = categorizeString(text, occurrences);

  // Initialize category if needed
  if (!messagesDE[category]) messagesDE[category] = {};
  if (!messagesEN[category]) messagesEN[category] = {};

  // Add to DE (original German)
  if (!messagesDE[category][key]) {
    messagesDE[category][key] = text;
    newKeysDE++;
    console.log(`  ✅ DE: ${category}.${key}`);
  }

  // Add to EN (placeholder for AI)
  if (!messagesEN[category][key]) {
    messagesEN[category][key] = `[TODO: ${text}]`;
    newKeysEN++;
  }

  // Store mapping
  keyMap[text] = { category, key };
});

// Save translation files
fs.writeFileSync(MESSAGES_DE, JSON.stringify(messagesDE, null, 2));
fs.writeFileSync(MESSAGES_EN, JSON.stringify(messagesEN, null, 2));

// Save key mapping for component updates
fs.writeFileSync(
  path.join(__dirname, 'translation-key-map.json'),
  JSON.stringify(keyMap, null, 2)
);

console.log(`\n✅ Added ${newKeysDE} new German keys`);
console.log(`✅ Added ${newKeysEN} new English placeholders`);
console.log(`💾 Saved translation files`);
console.log(`💾 Saved key mapping for component updates`);

console.log(`\n📋 Next step:`);
console.log(`   Run: node scripts/improve-translations-with-ai.js --api-key "YOUR_KEY"`);
console.log(`   This will translate all [TODO:...] entries to proper English`);
