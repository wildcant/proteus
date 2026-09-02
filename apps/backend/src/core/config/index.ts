export { ConfigManager } from './config-manager.js'
export type { ConfigModule, HttpConfig, InputConfig, WorkflowEngineName, WorkflowsConfig } from './types.js'

import { ConfigManager } from './config-manager.js'
import type { InputConfig } from './types.js'

export const configManager = new ConfigManager()

export function defineAppConfig(input?: InputConfig) {
  return configManager.loadConfig(input)
}
