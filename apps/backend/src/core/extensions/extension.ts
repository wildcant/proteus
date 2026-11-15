import type { AppContainer } from '../types/container.js'
import type { Logger } from '../types/logger.js'

/**
 * An extension's manifest, the default export of its `extension.ts`.
 *
 * The name is the folder's name (`pisos-dj`), and every name the extension adds to a namespace core
 * also writes into carries it as a prefix. `extensions:generate` reads it without running the file
 * and fails when it differs from the folder.
 */
type ExtensionManifest = { name: string }

/**
 * @extensionApi The extension and hook API: no core code calls it until a fork does, so the production
 * unused-code pass skips it (`scripts/checks/unused.sh`).
 */
export function defineExtension<const TManifest extends ExtensionManifest>(manifest: TManifest): TManifest {
  return manifest
}

/**
 * One dev seed step, the default export of a file in an extension's `seeds/`.
 *
 * Seed steps run at the end of the dev seed, in extension-name order and then file order, against
 * the dev seed's container. They are imported only by `scripts/seed-dev.ts`, never by a runtime
 * root, so a step may read files.
 */
export type ExtensionSeedStep = (context: { container: AppContainer; logger: Logger }) => Promise<void>
