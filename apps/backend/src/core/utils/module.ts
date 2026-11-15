import type { ModuleKey } from '../extensions/module-key.js'
import type { PermissionKey } from '../types/access-control/common.js'
import type { AppContainer, ModuleServiceContracts } from '../types/container.js'

// biome-ignore lint/suspicious/noExplicitAny: DI constructors accept varied dependency shapes
type Constructor<T = unknown> = new (...args: any[]) => T

export type LoaderFunction<TOptions = Record<string, unknown>> = (input: {
  container: AppContainer
  options?: TOptions
}) => void | Promise<void>

/**
 * A feature the module owns. The id has to be a `PermissionKey` under the module's own namespace,
 * so a typo or a key belonging to another module is a type error at the declaration rather than a
 * permission row nothing ever checks.
 */
export type FeatureDeclaration<Key extends string = string> = {
  id: Extract<PermissionKey, `${Key}.${string}`>
  title: string
}

/** Feature ids that appear more than once in a declaration list. */
type DuplicateFeatureIds<Features extends readonly FeatureDeclaration[], Seen = never> = Features extends readonly [
  infer Head extends FeatureDeclaration,
  ...infer Rest extends readonly FeatureDeclaration[],
]
  ? Head['id'] extends Seen
    ? Head['id'] | DuplicateFeatureIds<Rest, Seen | Head['id']>
    : DuplicateFeatureIds<Rest, Seen | Head['id']>
  : never

type NoDuplicateFeatureIds<Features extends readonly FeatureDeclaration[]> =
  DuplicateFeatureIds<Features> extends never
    ? unknown
    : { 'this feature id is declared twice': DuplicateFeatureIds<Features> }

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
  features?: readonly FeatureDeclaration[]
}

/** Public members the class has and the module's contract does not. */
type MethodsMissingFromContract<Service extends Constructor, Contract> = Exclude<
  keyof InstanceType<Service>,
  keyof Contract
>

/** The contract a key names: core's entry in `ModuleServiceContracts`, or the type a module key carries. */
type ContractOf<Key> = Key extends keyof ModuleServiceContracts
  ? ModuleServiceContracts[Key]
  : Key extends ModuleKey<infer TService>
    ? TService
    : never

type ModuleConfig<Service extends Constructor> = {
  service: Service
  repositories: Record<string, Constructor>
  models: Record<string, unknown>
  loaders?: LoaderFunction[]
  postLoaders?: LoaderFunction[]
}

type ContractGap<TMethods> = { 'these public methods are missing from the module contract': TMethods }

/**
 * A module's class says `implements IFooModuleService`, which is TypeScript checking that every
 * method the contract names exists. This is the other direction: a public method the class grew
 * and the contract never heard about becomes a third argument the call cannot supply. Callers
 * reach a module through `resolve(Modules.FOO)`, which hands back the contract, so a method
 * missing from it is a method nobody outside the module can call.
 */
export function Module<
  const Key extends keyof ModuleServiceContracts,
  const Service extends Constructor,
  const Features extends readonly FeatureDeclaration<Key>[] = [],
>(
  key: Key,
  config: ModuleConfig<Service> & { features?: Features & NoDuplicateFeatureIds<Features> },
  ...contractGap: MethodsMissingFromContract<Service, ContractOf<Key>> extends never
    ? []
    : [error: ContractGap<MethodsMissingFromContract<Service, ContractOf<Key>>>]
): ModuleDefinition
/**
 * An extension module, keyed by its `defineModuleKey` value and checked against the service type the
 * key carries. It declares no features: permission keys are a closed core list, and extension
 * permissions do not exist yet.
 */
export function Module<const Key extends ModuleKey, const Service extends Constructor>(
  key: Key,
  config: ModuleConfig<Service> & { features?: never },
  ...contractGap: MethodsMissingFromContract<Service, ContractOf<Key>> extends never
    ? []
    : [error: ContractGap<MethodsMissingFromContract<Service, ContractOf<Key>>>]
): ModuleDefinition
export function Module(
  key: string,
  config: ModuleConfig<Constructor> & { features?: readonly FeatureDeclaration[] },
): ModuleDefinition {
  return { key, ...config }
}
