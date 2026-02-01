#!/usr/bin/env node
/**
 * Improve auto-generated English translations using Gemini AI
 * Batch processing to minimize API costs
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MESSAGES_DE = path.join(__dirname, '../messages/de.json');
const MESSAGES_EN = path.join(__dirname, '../messages/en.json');

async function getGeminiApiKey() {
  // Check command line argument first: --api-key "YOUR_KEY"
  const args = process.argv.slice(2);
  const apiKeyIndex = args.indexOf('--api-key');
  if (apiKeyIndex !== -1 && args[apiKeyIndex + 1]) {
    return args[apiKeyIndex + 1];
  }

  // Try environment variable
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }

  throw new Error('Gemini API key not found. Usage: node improve-translations-with-ai.js --api-key "YOUR_KEY"');
}

async function improveTranslationsWithAI(translationPairs, apiKey) {
  const prompt = `You are a professional translator. Improve the following auto-generated English translations from German.

RULES:
1. Keep the technical meaning accurate
2. Use natural, fluent English
3. Preserve placeholders like {variable}, {{interpolation}}, or special characters
4. Keep it concise and clear
5. Maintain the same tone (formal/informal)

Input format: Array of objects with "de" (German original) and "en" (auto-generated English)
Output format: Same array with improved "en" values

IMPORTANT: Return ONLY valid JSON, no markdown, no explanations.

Translations to improve:
${JSON.stringify(translationPairs, null, 2)}`;

  console.log(`\n📤 Sending ${translationPairs.length} translations to Gemini...`);
  console.log(`   Estimated tokens: ~${prompt.length / 4}`);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt,
          }],
        }],
        generationConfig: {
          temperature: 0.3,
          topK: 32,
          topP: 1,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Parse JSON response
  let improved;
  try {
    // Remove markdown code blocks if present
    let cleanText = text.trim();
    cleanText = cleanText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
    cleanText = cleanText.replace(/^```\s*/, '').replace(/```\s*$/, '');

    improved = JSON.parse(cleanText);
  } catch (parseError) {
    console.error('❌ Failed to parse Gemini response');
    console.error('Response:', text.substring(0, 500));
    throw new Error(`Invalid JSON response: ${parseError.message}`);
  }

  const tokensUsed = {
    input: data.usageMetadata?.promptTokenCount || 0,
    output: data.usageMetadata?.candidatesTokenCount || 0,
  };

  console.log(`✅ Received improved translations`);
  console.log(`   Tokens used: ${tokensUsed.input} input + ${tokensUsed.output} output = ${tokensUsed.input + tokensUsed.output} total`);

  return { improved, tokensUsed };
}

async function main() {
  console.log('🤖 Improving English translations with Gemini AI...\n');

  // Load translations
  const messagesDE = JSON.parse(fs.readFileSync(MESSAGES_DE, 'utf8'));
  const messagesEN = JSON.parse(fs.readFileSync(MESSAGES_EN, 'utf8'));

  // Get API key
  console.log('🔑 Loading Gemini API key from database...');
  const apiKey = await getGeminiApiKey();
  console.log('✅ API key loaded\n');

  // Collect all translation pairs that need improvement
  const translationPairs = [];

  function collectPairs(deObj, enObj, prefix = '') {
    Object.entries(deObj).forEach(([key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null) {
        // Recurse into nested objects
        collectPairs(value, enObj[key] || {}, fullKey);
      } else if (typeof value === 'string') {
        const enValue = enObj[key] || '';

        // Improve if: has TODO placeholder, has German characters, or looks auto-generated
        if (enValue.startsWith('[TODO:') || enValue.match(/[äöüß]|ae|oe|ue|ss/) || enValue.toLowerCase() === value.toLowerCase()) {
          translationPairs.push({
            key: fullKey,
            de: value,
            en: enValue
          });
        }
      }
    });
  }

  collectPairs(messagesDE, messagesEN);

  console.log(`📊 Found ${translationPairs.length} translations to improve\n`);

  if (translationPairs.length === 0) {
    console.log('✅ All translations look good, nothing to improve!');
    return;
  }

  // Process in batches (max 50 at a time to avoid token limits)
  const BATCH_SIZE = 50;
  const batches = [];
  for (let i = 0; i < translationPairs.length; i += BATCH_SIZE) {
    batches.push(translationPairs.slice(i, i + BATCH_SIZE));
  }

  console.log(`📦 Processing ${batches.length} batch(es)...\n`);

  let totalTokens = 0;
  const improvements = new Map();

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`\n🔄 Batch ${i + 1}/${batches.length} (${batch.length} translations)`);

    try {
      const { improved, tokensUsed } = await improveTranslationsWithAI(batch, apiKey);
      totalTokens += tokensUsed.input + tokensUsed.output;

      // Store improvements
      improved.forEach(item => {
        improvements.set(item.key, item.en);
      });

      // Small delay between batches
      if (i < batches.length - 1) {
        console.log('   ⏳ Waiting 1s before next batch...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`\n❌ Error processing batch ${i + 1}:`, error.message);
      console.log('   Skipping this batch and continuing...\n');
    }
  }

  // Apply improvements to messagesEN
  console.log(`\n📝 Applying ${improvements.size} improvements...\n`);

  function applyImprovements(obj, prefix = '') {
    Object.entries(obj).forEach(([key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null) {
        applyImprovements(value, fullKey);
      } else if (improvements.has(fullKey)) {
        const oldValue = obj[key];
        const newValue = improvements.get(fullKey);

        if (oldValue !== newValue) {
          console.log(`  ✏️  ${fullKey}`);
          console.log(`     OLD: "${oldValue}"`);
          console.log(`     NEW: "${newValue}"`);
          obj[key] = newValue;
        }
      }
    });
  }

  applyImprovements(messagesEN);

  // Save updated translations
  fs.writeFileSync(MESSAGES_EN, JSON.stringify(messagesEN, null, 2));

  console.log(`\n✅ Improvements applied!`);
  console.log(`📊 Total tokens used: ${totalTokens}`);
  console.log(`💾 Updated translations saved to: ${MESSAGES_EN}`);
  console.log(`\n💰 Estimated cost: ~$${(totalTokens / 1000000 * 0.35).toFixed(4)} USD`);
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
