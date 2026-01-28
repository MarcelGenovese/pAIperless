/**
 * Next.js Instrumentation Hook
 *
 * This file is automatically executed when the Next.js server starts.
 * We use it to initialize services (FTP server, worker) after the application boots.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server-side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Initializing pAIperless services...');

    try {
      // Dynamically import to avoid loading on client
      const { initializeServices } = await import('./lib/services/init');

      // Wait a bit for the server to fully start
      setTimeout(async () => {
        await initializeServices();
        console.log('[Instrumentation] Services initialization completed');
      }, 5000);
    } catch (error) {
      console.error('[Instrumentation] Failed to initialize services:', error);
    }
  }
}
