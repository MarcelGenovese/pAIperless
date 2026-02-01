#!/usr/bin/env node
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.argv[2];
if (!apiKey) {
  console.error('Usage: node list-gemini-models.js YOUR_API_KEY');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testModels() {
  const modelsToTest = [
    'gemini-pro',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-2.0-flash-exp',
    'models/gemini-pro',
    'models/gemini-1.5-flash'
  ];

  for (const modelName of modelsToTest) {
    try {
      console.log(`Testing model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Hello');
      console.log(`  ✅ ${modelName} - WORKS`);
      console.log(`     Response: ${result.response.text().substring(0, 50)}...`);
    } catch (error) {
      console.log(`  ❌ ${modelName} - FAILED: ${error.message.substring(0, 80)}`);
    }
  }
}

testModels();
