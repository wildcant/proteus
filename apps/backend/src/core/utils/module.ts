import type { AppContainer, ModuleServiceContracts } from '../types/container.js'

// biome-ignore lint/suspicious/noExplicitAny: DI constructors accept varied dependency shapes
type Constructor<T = unknown> = new (...args: any[]) => T

export type LoaderFunction<TOptions = Record<string, unknown>> = (input: {
  container: AppContainer
  options?: TOptions
}) => void | Promise<void>

export type FeatureDeclaration = {
  id: string
  title: string
}

export type ModuleDefinition = {
  key: string
  service: Constructor
  repositories: Record<string, Constructor>
  /**
   * The module's models barrel, passed whole. Bootstrap filters it to drizzle tables and builds
   * the inverse foreign-key index the cascade walker follows, so what a soft delete reaches is
   * a fact about the schema rather than a list a service has to keep in step.
   */
  models: Record<string, unknown>
  loaders?: LoaderFunction[]
  postLoaders?: LoaderFunction[]
  features?: FeatureDeclaration[]
}

/** Public members the class has and the module's contract in `core/types/` does not. */
type MethodsMissingFromContract<Service extends Constructor, Key extends keyof ModuleServiceContracts> = Exclude<
  keyof InstanceType<Service>,
  keyof ModuleServiceContracts[Key]
>

type ContractGap<TMethods> = { 'these public methods are missing from the module contract': TMethods }

/**
 * A module's class says `implements IFooModuleService`, which is TypeScript checking that every
 * method the contract names exists. This is the other direction: a public method the class grew
 * and the contract never heard about becomes a third argument the call cannot supply. Callers
 * reach a module through `resolve(Modules.FOO)`, which hands back the contract, so a method
 * missing from it is a method nobody outside the module can call.
 */
export function Module<const Key extends keyof ModuleServiceContracts, const Service extends Constructor>(
  key: Key,
  config: {
    service: Service
    repositories: Record<string, Constructor>
    models: Record<string, unknown>
    loaders?: LoaderFunction[]
    postLoaders?: LoaderFunction[]
    features?: FeatureDeclaration[]
  },
  ...contractGap: MethodsMissingFromContract<Service, Key> extends never
    ? []
    : [error: ContractGap<MethodsMissingFromContract<Service, Key>>]
): ModuleDefinition {
  void contractGap
  return { key, ...config }
}
