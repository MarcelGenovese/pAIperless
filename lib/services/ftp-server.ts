/**
 * FTP Server Service
 *
 * Manages the FTP server for document uploads.
 * Files uploaded via FTP are placed in the /consume directory for processing.
 */

import FtpSrv from 'ftp-srv';
import { getConfig, getConfigSecure, CONFIG_KEYS } from '@/lib/config';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

interface FTPServerStatus {
  running: boolean;
  enabled: boolean;
  port: number | null;
  url: string | null;
  username: string | null;
  tlsEnabled: boolean;
  error: string | null;
}

class FTPServerService {
  private server: FtpSrv | null = null;
  private isRunning: boolean = false;
  private config: {
    enabled: boolean;
    username: string;
    password: string;
    port: number;
    enableTls: boolean;
  } | null = null;

  /**
   * Load configuration from database
   */
  private async loadConfig() {
    try {
      const enabled = (await getConfig(CONFIG_KEYS.FTP_ENABLED)) === 'true';
      const username = await getConfig(CONFIG_KEYS.FTP_USERNAME);
      const password = await getConfigSecure(CONFIG_KEYS.FTP_PASSWORD);
      const portStr = await getConfig(CONFIG_KEYS.FTP_PORT);
      const enableTlsStr = await getConfig(CONFIG_KEYS.FTP_ENABLE_TLS);

      if (!enabled) {
        this.config = null;
        return false;
      }

      if (!username || !password || !portStr) {
        console.error('[FTP] Missing required configuration');
        this.config = null;
        return false;
      }

      const port = parseInt(portStr, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        console.error('[FTP] Invalid port number:', portStr);
        this.config = null;
        return false;
      }

      this.config = {
        enabled,
        username,
        password,
        port,
        enableTls: enableTlsStr === 'true',
      };

      return true;
    } catch (error) {
      console.error('[FTP] Error loading configuration:', error);
      this.config = null;
      return false;
    }
  }

  /**
   * Log to database
   */
  private async log(level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: any) {
    try {
      await prisma.log.create({
        data: {
          level,
          message: `[FTP] ${message}`,
          meta: meta ? JSON.stringify(meta) : null,
        },
      });
    } catch (error) {
      console.error('[FTP] Failed to write log:', error);
    }
  }

  /**
   * Ensure consume directory exists
   */
  private ensureConsumeDirectory() {
    // Use environment variable or default to /app/storage/consume
    // For local development, use ./test-consume
    let consumeDir = process.env.CONSUME_DIR || '/app/storage/consume';

    // Check if we're in development mode (not in Docker)
    if (!fs.existsSync('/app/storage') && fs.existsSync('./test-consume')) {
      consumeDir = './test-consume';
    }

    try {
      if (!fs.existsSync(consumeDir)) {
        fs.mkdirSync(consumeDir, { recursive: true });
        console.log(`[FTP] Created consume directory: ${consumeDir}`);
      }
      return consumeDir;
    } catch (error: any) {
      console.error(`[FTP] Failed to create consume directory: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get PASV URL dynamically from connection
   * This uses the IP address that the client connected to
   */
  private getPasvUrlFromConnection(connection: any): string {
    try {
      // Check if FTP_PASV_URL is set (manual override)
      if (process.env.FTP_PASV_URL && process.env.FTP_PASV_URL !== '0.0.0.0') {
        return process.env.FTP_PASV_URL;
      }

      // Try to get the local address from the connection's command socket
      // This is the IP address the client connected to
      if (connection.commandSocket?.localAddress) {
        const localAddress = connection.commandSocket.localAddress;

        // Convert IPv6 localhost to IPv4
        if (localAddress === '::' || localAddress === '::1' || localAddress === '::ffff:127.0.0.1') {
          return '127.0.0.1';
        }

        // Remove IPv6 prefix if present (::ffff:192.168.1.1 -> 192.168.1.1)
        if (localAddress.startsWith('::ffff:')) {
          return localAddress.substring(7);
        }

        return localAddress;
      }

      // Alternative: try connection.server.address()
      if (connection.server?.address) {
        const address = typeof connection.server.address === 'function'
          ? connection.server.address()
          : connection.server.address;

        if (address?.address) {
          const serverAddress = address.address;
          if (serverAddress === '::' || serverAddress === '::1') {
            return '127.0.0.1';
          }
          return serverAddress;
        }
      }
    } catch (error) {
      console.warn('[FTP] Could not determine server IP from connection:', error);
    }

    // Last resort: return 0.0.0.0
    console.warn('[FTP] Falling back to 0.0.0.0 for PASV - this may not work for external clients');
    return '0.0.0.0';
  }

  /**
   * Start the FTP server
   */
  async start(): Promise<{ success: boolean; message: string }> {
    try {
      // Check if already running
      if (this.isRunning && this.server) {
        return { success: true, message: 'FTP server is already running' };
      }

      // Load configuration
      const configLoaded = await this.loadConfig();
      if (!configLoaded || !this.config) {
        return { success: false, message: 'FTP server is not configured or disabled' };
      }

      // Ensure consume directory exists
      const consumeDir = this.ensureConsumeDirectory();

      // Create FTP server options
      // Use a function for pasv_url to dynamically get the IP from each connection
      const serverOptions: any = {
        url: `ftp://0.0.0.0:${this.config.port}`,
        pasv_url: (connection: any) => {
          // Use the IP address that the client connected to
          const serverIp = this.getPasvUrlFromConnection(connection);
          console.log(`[FTP] PASV mode using server IP: ${serverIp}`);
          return serverIp;
        },
        pasv_min: 1024,
        pasv_max: 1048,
        anonymous: false,
        greeting: ['Welcome to pAIperless FTP Server', 'Upload PDFs to automatically process them.'],
        timeout: 30000,
      };

      // Add TLS if enabled
      if (this.config.enableTls) {
        // For now, we'll use self-signed certificates
        // In production, users should provide their own certificates
        console.log('[FTP] TLS is enabled but certificate management is not yet implemented');
        console.log('[FTP] Server will run without TLS. Please configure certificates in production.');
        // serverOptions.tls = {
        //   key: fs.readFileSync(path.join('/app/certs', 'server.key')),
        //   cert: fs.readFileSync(path.join('/app/certs', 'server.crt')),
        // };
      }

      // Create server instance
      this.server = new FtpSrv(serverOptions);

      // Handle login
      this.server.on('login', ({ connection, username, password }, resolve, reject) => {
        if (this.config && username === this.config.username && password === this.config.password) {
          const clientIp = connection.commandSocket?.remoteAddress || 'unknown';
          const serverIp = connection.commandSocket?.localAddress || 'unknown';
          console.log(`[FTP] User logged in: ${username} from ${clientIp} to server IP ${serverIp}`);
          this.log('INFO', `User logged in: ${username} from ${clientIp} to ${serverIp}`);
          resolve({ root: consumeDir });
        } else {
          console.log(`[FTP] Login failed for user: ${username}`);
          this.log('WARN', `Login failed for user: ${username}`);
          reject(new Error('Invalid username or password'));
        }
      });

      // Handle errors
      this.server.on('client-error', (connection, context, error) => {
        console.error('[FTP] Client error:', error);
        this.log('ERROR', 'Client error', { error: error.message, context });
      });

      // Handle disconnect
      this.server.on('disconnect', (connection) => {
        console.log('[FTP] Client disconnected');
      });

      // Start listening
      await this.server.listen();
      this.isRunning = true;

      const message = `FTP server started on port ${this.config.port}`;
      console.log(`[FTP] ${message}`);
      await this.log('INFO', message, {
        port: this.config.port,
        username: this.config.username,
        tlsEnabled: this.config.enableTls,
        consumeDir,
      });

      return { success: true, message };
    } catch (error: any) {
      // Check if error is EADDRINUSE
      if (error.code === 'EADDRINUSE' || error.message.includes('EADDRINUSE')) {
        const message = `FTP server port ${this.config?.port} is already in use. Server may already be running.`;
        console.error(`[FTP] ${message}`);
        await this.log('WARN', message, { error: error.message });

        // Mark as running since the port is in use (likely by our own server)
        this.isRunning = true;
        return { success: true, message: 'FTP server is already running on this port' };
      }

      const message = `Failed to start FTP server: ${error.message}`;
      console.error(`[FTP] ${message}`);
      await this.log('ERROR', message, { error: error.message, stack: error.stack });
      this.isRunning = false;
      this.server = null;
      return { success: false, message };
    }
  }

  /**
   * Stop the FTP server
   */
  async stop(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.isRunning || !this.server) {
        // Reset state even if we think it's not running
        this.server = null;
        this.isRunning = false;
        return { success: true, message: 'FTP server is not running' };
      }

      await this.server.close();
      this.server = null;
      this.isRunning = false;

      const message = 'FTP server stopped';
      console.log(`[FTP] ${message}`);
      await this.log('INFO', message);

      // Wait a bit to ensure port is released
      await new Promise(resolve => setTimeout(resolve, 500));

      return { success: true, message };
    } catch (error: any) {
      // Reset state even on error
      this.server = null;
      this.isRunning = false;

      const message = `Failed to stop FTP server: ${error.message}`;
      console.error(`[FTP] ${message}`);
      await this.log('ERROR', message, { error: error.message });
      return { success: false, message };
    }
  }

  /**
   * Restart the FTP server
   */
  async restart(): Promise<{ success: boolean; message: string }> {
    console.log('[FTP] Restarting server...');
    await this.log('INFO', 'Restarting server');

    // Always try to stop first, even if we think it's not running
    try {
      const stopResult = await this.stop();
      if (!stopResult.success && stopResult.message.includes('Failed')) {
        console.warn('[FTP] Stop failed during restart, continuing anyway...');
      }
    } catch (error) {
      console.warn('[FTP] Error during stop, continuing with start...', error);
    }

    // Wait for port to be fully released
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Start again
    return await this.start();
  }

  /**
   * Get server status
   */
  async getStatus(): Promise<FTPServerStatus> {
    try {
      await this.loadConfig();

      if (!this.config) {
        return {
          running: false,
          enabled: false,
          port: null,
          url: null,
          username: null,
          tlsEnabled: false,
          error: 'FTP server is not configured or disabled',
        };
      }

      return {
        running: this.isRunning,
        enabled: this.config.enabled,
        port: this.config.port,
        url: this.isRunning ? `ftp://${this.config.username}@localhost:${this.config.port}` : null,
        username: this.config.username,
        tlsEnabled: this.config.enableTls,
        error: null,
      };
    } catch (error: any) {
      return {
        running: false,
        enabled: false,
        port: null,
        url: null,
        username: null,
        tlsEnabled: false,
        error: error.message,
      };
    }
  }
}

// Singleton instance
const ftpServerService = new FTPServerService();

export default ftpServerService;
export { FTPServerService };
export type { FTPServerStatus };
