/**
 * Emergency Stop System
 * Allows stopping all processing immediately
 */

import { getConfig, setConfig, CONFIG_KEYS } from './config';
import { createLogger } from './logger';

const logger = createLogger('EmergencyStop');

export const EMERGENCY_STOP_KEY = 'EMERGENCY_STOP_ACTIVE';

/**
 * Check if emergency stop is active
 */
export async function isEmergencyStopActive(): Promise<boolean> {
  try {
    const value = await getConfig(EMERGENCY_STOP_KEY);
    return value === 'true';
  } catch (error) {
    await logger.error('Failed to check emergency stop status', error);
    return false;
  }
}

/**
 * Activate emergency stop
 * Prevents all processing from starting
 */
export async function activateEmergencyStop(): Promise<void> {
  try {
    await setConfig(EMERGENCY_STOP_KEY, 'true');
    await logger.warn('🚨 EMERGENCY STOP ACTIVATED - All processing halted');
  } catch (error) {
    await logger.error('Failed to activate emergency stop', error);
    throw error;
  }
}

/**
 * Deactivate emergency stop
 * Allows processing to resume
 */
export async function deactivateEmergencyStop(): Promise<void> {
  try {
    await setConfig(EMERGENCY_STOP_KEY, 'false');
    await logger.info('✅ Emergency stop deactivated - Processing can resume');
  } catch (error) {
    await logger.error('Failed to deactivate emergency stop', error);
    throw error;
  }
}

/**
 * Check emergency stop and throw if active
 * Use this at the start of any processing function
 */
export async function checkEmergencyStop(processName: string): Promise<void> {
  const isActive = await isEmergencyStopActive();
  if (isActive) {
    const message = `${processName} blocked by emergency stop`;
    await logger.warn(`🚨 ${message}`);
    throw new Error(message);
  }
}
