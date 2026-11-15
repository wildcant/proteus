/**
 * The extensions a test container carries: the fork's own (`src/extensions/`, empty upstream) and the
 * fixture's, which stands in for a fork's so the suite covers the mechanism while no real extension
 * lives upstream. A fork's extension tests resolve its modules and reach its routes through this.
 */

import { extensionRegistry as generatedRegistry } from '../../src/extensions/registry.gen.js'
import type { ExtensionRegistry } from '../../src/framework/extensions/types.js'
import { extensionRegistry as fixtureRegistry } from '../extension-fixture/registry.gen.js'

export const testExtensions: ExtensionRegistry = {
  extensions: [...generatedRegistry.extensions, ...fixtureRegistry.extensions],
  modules: [...generatedRegistry.modules, ...fixtureRegistry.modules],
  routes: {
    store: [...generatedRegistry.routes.store, ...fixtureRegistry.routes.store],
    hooks: [...generatedRegistry.routes.hooks, ...fixtureRegistry.routes.hooks],
  },
  hookHandlers: [...generatedRegistry.hookHandlers, ...fixtureRegistry.hookHandlers],
  catalogs: [...generatedRegistry.catalogs, ...fixtureRegistry.catalogs],
}
