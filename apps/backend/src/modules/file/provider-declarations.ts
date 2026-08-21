import localfsProvider from '../../providers/file-localfs/index.js'
import type { FileModuleOptions } from './loaders/providers.js'

/**
 * Single source of truth for which file providers are configured.
 * Used by container.ts (DI registration).
 */
export const fileProviderDeclarations: FileModuleOptions = {
  provider: {
    resolve: localfsProvider,
    id: 'local',
  },
}
