import type { FileModuleOptions } from './loaders/providers.js'

/**
 * Single source of truth for which file providers are configured.
 * Used by container.ts (DI registration).
 *
 * Replace the placeholder entry with a real provider (e.g. S3, local filesystem).
 */
export const fileProviderDeclarations: FileModuleOptions = {
  providers: [],
}
