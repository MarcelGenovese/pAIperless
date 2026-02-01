#!/usr/bin/env node

/**
 * Initialize default configuration values
 * Run this during docker entrypoint or first setup
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_CONFIG = {
  // Document AI Limits
  DOCUMENT_AI_MAX_PAGES: '15',
  DOCUMENT_AI_MAX_SIZE_MB: '20',
  DOCUMENT_AI_ENABLED: 'false', // Disabled by default until setup complete

  // Paperless Tags
  TAG_AI_TODO: 'ai_todo',
  TAG_ACTION_REQUIRED: 'action_required',
};

async function initDefaults() {
  console.log('[Init] Setting default configuration values...');

  for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
    try {
      // Check if config already exists
      const existing = await prisma.config.findUnique({
        where: { key },
      });

      if (!existing) {
        await prisma.config.create({
          data: { key, value },
        });
        console.log(`[Init] ✅ Set default: ${key} = ${value}`);
      } else {
        console.log(`[Init] ⏭️  Skipped (exists): ${key}`);
      }
    } catch (error) {
      console.error(`[Init] ❌ Failed to set ${key}:`, error.message);
    }
  }

  console.log('[Init] Default configuration initialized');
}

initDefaults()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
