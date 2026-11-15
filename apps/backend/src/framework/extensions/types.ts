import type { Messages } from '@lingui/core'
import type { ExtensionSeedStep } from '../../core/extensions/extension.js'
import type { ModuleDefinition } from '../../core/utils/module.js'
import type { ModuleProviderExports } from '../../core/utils/module-provider.js'
import type { HookHandlerDefinition } from '../../core/workflows/hook-handler.js'
import type { RouteDefinition } from '../http/types.js'

/**
 * Everything the runtime roots read from the extensions, as `extensions:generate` writes it into
 * `src/extensions/registry.gen.ts`: static imports, because workerd has no file system at runtime and
 * the Temporal Worker runs steps in its own process.
 *
 * The container bootstrap, route preparation and the translator take it as a dependency rather than
 * importing it, so the test suite passes the fixture extension's registry instead.
 */
export type ExtensionRegistry = {
  /** The manifests, sorted by name. */
  extensions: { name: string }[]
  /** Bootstrapped after core's modules, each into its own private container. */
  modules: ModuleDefinition[]
  /** Added to route preparation's store and webhook arrays, so namespace auth and OpenAPI apply. */
  routes: { store: RouteDefinition[]; hooks: RouteDefinition[] }
  /** At most one per hook; a second fails generation. */
  hookHandlers: HookHandlerDefinition[]
  /** Each extension's compiled catalogs, language → messages, merged after core's. */
  catalogs: { extension: string; messages: Record<string, Messages> }[]
  /**
   * Each extension's fulfillment providers, one per file in its `providers/fulfillment/`. The
   * fulfillment module registers each class as `fp_<identifier>_default`, built from the shared
   * container, and the provider sync writes their rows.
   */
  fulfillmentProviders: { extension: string; resolve: ModuleProviderExports }[]
}

/** One dev seed step, as `seeds.gen.ts` lists it: run in extension-name, then file-name, order. */
export type ExtensionSeed = {
  extension: string
  /** The seed file's name, `notes` for `seeds/notes.ts`. */
  name: string
  run: ExtensionSeedStep
}
