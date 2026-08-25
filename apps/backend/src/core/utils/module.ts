import type { AwilixContainer } from 'awilix'

// biome-ignore lint/suspicious/noExplicitAny: DI constructors accept varied dependency shapes
type Constructor<T = unknown> = new (...args: any[]) => T

export type LoaderFunction<TOptions = Record<string, unknown>> = (input: {
  container: AwilixContainer
  options?: TOptions
}) => void | Promise<void>

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
}

export function Module<const Key extends string, const Service extends Constructor>(
  key: Key,
  config: {
    service: Service
    repositories: Record<string, Constructor>
    models: Record<string, unknown>
    loaders?: LoaderFunction[]
  },
): ModuleDefinition {
  return { key, ...config }
}
