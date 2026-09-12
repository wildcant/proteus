import type { InputConfig } from '../../core/types/config.js'
import { ConfigManager } from './config-manager.js'

export const configManager = new ConfigManager()

export function defineAppConfig(input?: InputConfig) {
  return configManager.loadConfig(input)
}
