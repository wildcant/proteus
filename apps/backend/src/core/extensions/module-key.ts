declare const serviceBrand: unique symbol

/**
 * An extension module's container key, carrying the type of the service registered under it.
 *
 * Core's keys (`Modules`) and their contracts (`ModuleServiceContracts`) are closed lists an
 * extension may not edit, so an extension's key brings its type with it instead: `resolve(key)` on
 * the shared container returns `TService`, and `Module(key, …)` checks the class against it.
 *
 * The brand exists only in the type. At runtime a key is the string it was defined with, which is
 * what Awilix registers.
 */
export type ModuleKey<TService = unknown> = string & { readonly [serviceBrand]: TService }

/**
 * Declared in the extension's `keys.ts`, in one object per extension:
 *
 * ```ts
 * export const PisosDjModules = { SHIPPING: defineModuleKey<IShippingService>('pisos-dj.shipping') }
 * ```
 *
 * The key carries the extension's runtime prefix (`pisos-dj.`), which `extensions:generate` checks,
 * along with a collision against any core module key.
 *
 * @extensionApi The extension and hook API: no core code calls it until a fork does, so the production
 * unused-code pass skips it (`scripts/checks/unused.sh`).
 */
export function defineModuleKey<TService>(key: string): ModuleKey<TService> {
  return key as ModuleKey<TService>
}
