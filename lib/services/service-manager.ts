/**
 * Service Manager
 *
 * Centralized management for all pAIperless services:
 * - FTP Server
 * - Worker (File Processing)
 * - Future services (email notifications, etc.)
 */

import ftpServerService, { FTPServerStatus } from './ftp-server';
import { startWorker, stopWorker } from '@/lib/worker';
import { prisma } from '@/lib/prisma';

export type ServiceName = 'ftp' | 'worker' | 'all';

export interface ServiceStatus {
  name: string;
  running: boolean;
  enabled: boolean;
  message: string;
  details?: any;
}

export interface ServiceControlResult {
  success: boolean;
  message: string;
  services?: Record<string, ServiceStatus>;
}

class ServiceManager {
  private workerRunning: boolean = false;

  /**
   * Log to database
   */
  private async log(level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: any) {
    try {
      await prisma.log.create({
        data: {
          level,
          message: `[ServiceManager] ${message}`,
          meta: meta ? JSON.stringify(meta) : null,
        },
      });
    } catch (error) {
      console.error('[ServiceManager] Failed to write log:', error);
    }
  }

  /**
   * Start FTP server
   */
  private async startFTP(): Promise<ServiceControlResult> {
    console.log('[ServiceManager] Starting FTP server...');
    const result = await ftpServerService.start();
    // Don't log as error if FTP is just disabled
    const logLevel = result.success ? 'INFO' :
                     (result.message.includes('disabled') || result.message.includes('not configured')) ? 'INFO' : 'ERROR';
    await this.log(logLevel, `FTP start: ${result.message}`);
    return result;
  }

  /**
   * Stop FTP server
   */
  private async stopFTP(): Promise<ServiceControlResult> {
    console.log('[ServiceManager] Stopping FTP server...');
    const result = await ftpServerService.stop();
    await this.log('INFO', `FTP stop: ${result.message}`);
    return result;
  }

  /**
   * Restart FTP server
   */
  private async restartFTP(): Promise<ServiceControlResult> {
    console.log('[ServiceManager] Restarting FTP server...');
    const result = await ftpServerService.restart();
    await this.log('INFO', `FTP restart: ${result.message}`);
    return result;
  }

  /**
   * Start worker
   */
  private async startWorker(): Promise<ServiceControlResult> {
    console.log('[ServiceManager] Starting worker...');
    try {
      startWorker();
      this.workerRunning = true;
      await this.log('INFO', 'Worker started successfully');
      return {
        success: true,
        message: 'Worker started successfully',
      };
    } catch (error: any) {
      await this.log('ERROR', `Failed to start worker: ${error.message}`);
      return {
        success: false,
        message: `Failed to start worker: ${error.message}`,
      };
    }
  }

  /**
   * Stop worker
   */
  private async stopWorker(): Promise<ServiceControlResult> {
    console.log('[ServiceManager] Stopping worker...');
    try {
      stopWorker();
      this.workerRunning = false;
      await this.log('INFO', 'Worker stopped successfully');
      return {
        success: true,
        message: 'Worker stopped successfully',
      };
    } catch (error: any) {
      await this.log('ERROR', `Failed to stop worker: ${error.message}`);
      return {
        success: false,
        message: `Failed to stop worker: ${error.message}`,
      };
    }
  }

  /**
   * Restart worker (placeholder - will be implemented later)
   */
  private async restartWorker(): Promise<ServiceControlResult> {
    console.log('[ServiceManager] Restarting worker...');
    await this.stopWorker();
    await new Promise(resolve => setTimeout(resolve, 1000));
    return await this.startWorker();
  }

  /**
   * Start all services
   */
  async startAll(): Promise<ServiceControlResult> {
    console.log('[ServiceManager] Starting all services...');
    await this.log('INFO', 'Starting all services');

    const results: string[] = [];
    let allSuccess = true;

    // Start FTP
    const ftpResult = await this.startFTP();
    results.push(`FTP: ${ftpResult.message}`);
    // Don't count as failure if FTP is just disabled
    if (!ftpResult.success &&
        !ftpResult.message.includes('disabled') &&
        !ftpResult.message.includes('not configured')) {
      allSuccess = false;
    }

    // Start Worker
    const workerResult = await this.startWorker();
    results.push(`Worker: ${workerResult.message}`);
    if (!workerResult.success) allSuccess = false;

    const message = results.join(', ');
    await this.log(allSuccess ? 'INFO' : 'WARN', `Start all completed: ${message}`);

    return {
      success: allSuccess,
      message,
      services: await this.getAllStatus(),
    };
  }

  /**
   * Stop all services
   */
  async stopAll(): Promise<ServiceControlResult> {
    console.log('[ServiceManager] Stopping all services...');
    await this.log('INFO', 'Stopping all services');

    const results: string[] = [];
    let allSuccess = true;

    // Stop FTP
    const ftpResult = await this.stopFTP();
    results.push(`FTP: ${ftpResult.message}`);
    if (!ftpResult.success) allSuccess = false;

    // Stop Worker
    const workerResult = await this.stopWorker();
    results.push(`Worker: ${workerResult.message}`);
    if (!workerResult.success) allSuccess = false;

    const message = results.join(', ');
    await this.log('INFO', `Stop all completed: ${message}`);

    return {
      success: allSuccess,
      message,
      services: await this.getAllStatus(),
    };
  }

  /**
   * Restart specific service
   */
  async restart(serviceName: ServiceName): Promise<ServiceControlResult> {
    console.log(`[ServiceManager] Restarting service: ${serviceName}`);
    await this.log('INFO', `Restarting service: ${serviceName}`);

    if (serviceName === 'all') {
      // Stop all
      await this.stopAll();
      await new Promise(resolve => setTimeout(resolve, 2000));
      // Start all
      return await this.startAll();
    }

    switch (serviceName) {
      case 'ftp':
        return await this.restartFTP();
      case 'worker':
        return await this.restartWorker();
      default:
        return {
          success: false,
          message: `Unknown service: ${serviceName}`,
        };
    }
  }

  /**
   * Get status of all services
   */
  async getAllStatus(): Promise<Record<string, ServiceStatus>> {
    // FTP Status
    const ftpStatus = await ftpServerService.getStatus();
    const ftp: ServiceStatus = {
      name: 'FTP Server',
      running: ftpStatus.running,
      enabled: ftpStatus.enabled,
      message: ftpStatus.error || (ftpStatus.running ? 'Läuft' : ftpStatus.enabled ? 'Gestoppt' : 'Deaktiviert'),
      details: ftpStatus,
    };

    // Worker Status
    const worker: ServiceStatus = {
      name: 'Worker',
      running: this.workerRunning,
      enabled: true,
      message: this.workerRunning ? 'Läuft' : 'Gestoppt',
      details: { watchingDirectory: '/app/storage/consume' },
    };

    return {
      ftp,
      worker,
    };
  }

  /**
   * Get status of specific service
   */
  async getStatus(serviceName: ServiceName): Promise<ServiceStatus | null> {
    const allStatus = await this.getAllStatus();

    if (serviceName === 'all') {
      return null;
    }

    return allStatus[serviceName] || null;
  }

  /**
   * Reload configuration for all services
   * This is useful after settings are changed in the UI
   */
  async reloadConfig(): Promise<ServiceControlResult> {
    console.log('[ServiceManager] Reloading configuration for all services...');
    await this.log('INFO', 'Reloading configuration');

    // For now, we restart all services to pick up new config
    return await this.restart('all');
  }
}

// Singleton instance
const serviceManager = new ServiceManager();

export default serviceManager;
export { ServiceManager };
