/**
 * Service Initialization
 *
 * Handles automatic startup of services when the application starts.
 * This ensures that FTP server and worker are running if setup is complete.
 */

import serviceManager from './service-manager';
import { getConfig, CONFIG_KEYS } from '@/lib/config';
import { prisma } from '@/lib/prisma';

let initialized = false;

/**
 * Initialize all services on application startup
 */
export async function initializeServices(): Promise<void> {
  // Prevent multiple initializations
  if (initialized) {
    console.log('[Init] Services already initialized');
    return;
  }

  try {
    console.log('[Init] Checking if setup is complete...');

    // Check if setup is complete
    const setupComplete = await getConfig(CONFIG_KEYS.SETUP_COMPLETED);

    if (setupComplete !== 'true') {
      console.log('[Init] Setup not complete, skipping service initialization');
      return;
    }

    console.log('[Init] Setup complete, starting services...');

    // Log initialization start
    await prisma.log.create({
      data: {
        level: 'INFO',
        message: '[Init] Starting services on application startup',
        meta: JSON.stringify({ timestamp: new Date().toISOString() }),
      },
    });

    // Start all services
    const result = await serviceManager.startAll();

    if (result.success) {
      console.log('[Init] Services started successfully');
      await prisma.log.create({
        data: {
          level: 'INFO',
          message: '[Init] Services started successfully',
          meta: JSON.stringify({ result, timestamp: new Date().toISOString() }),
        },
      });
    } else {
      console.error('[Init] Some services failed to start:', result.message);
      await prisma.log.create({
        data: {
          level: 'WARN',
          message: '[Init] Some services failed to start',
          meta: JSON.stringify({ result, timestamp: new Date().toISOString() }),
        },
      });
    }

    initialized = true;
  } catch (error: any) {
    console.error('[Init] Error initializing services:', error);
    await prisma.log.create({
      data: {
        level: 'ERROR',
        message: '[Init] Error initializing services',
        meta: JSON.stringify({
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        }),
      },
    });
  }
}

/**
 * Reset initialization flag (useful for testing)
 */
export function resetInitialization(): void {
  initialized = false;
}

export default { initializeServices, resetInitialization };
