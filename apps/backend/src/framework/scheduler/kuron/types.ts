// biome-ignore-all lint/style/useNamingConvention: Matches Cloudflare Workers type conventions (Bindings, Variables)

export type Bindings = object
export type Variables = object

export type Env = {
  Bindings?: Bindings
  Variables?: Variables
}

export type BlankEnv = {
  Bindings: Bindings
  Variables: Variables
}

export type CronContext<E extends Env = BlankEnv, P extends CronPattern = CronPattern> = ScheduledController & {
  env: E['Bindings']
  var: E['Variables']
  executionCtx: ExecutionContext
  cron: P
  name?: string
  get: <K extends keyof E['Variables']>(key: K) => E['Variables'][K]
  set: <K extends keyof E['Variables']>(key: K, value: E['Variables'][K]) => void
}

export type CronHandler<E extends Env = BlankEnv, P extends CronPattern = CronPattern> = (
  c: CronContext<E, P>,
) => Promise<void> | void

export type CronMiddleware<E extends Env = BlankEnv> = (
  c: CronContext<E>,
  next: () => Promise<void>,
) => Promise<void> | void

export type CronErrorHandler<E extends Env = BlankEnv> = (err: Error, c: CronContext<E>) => Promise<void> | void

export type ScheduledJob<E extends Env = BlankEnv, P extends CronPattern = CronPattern> = {
  pattern: P
  handler: CronHandler<E, P>
  name?: string
}

export type CronPattern = `${string} ${string} ${string} ${string} ${string}`
