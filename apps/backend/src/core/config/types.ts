import type { ActorType } from '@proteus/http-schemas/auth'

export type HttpConfig = {
  authMethodsPerActor: Partial<Record<ActorType, string[]>>
  authVerificationsPerActor: Partial<Record<ActorType, { entityType: string; authProvider: string }[]>>
}

/** Which `WorkflowEngine` adapter `bootstrapContainer` wires. */
export type WorkflowEngineName = 'simple' | 'temporal'

export type WorkflowsConfig = {
  /**
   * Left unset — the normal case — the composition root derives the engine from `RUNTIME`:
   * workerd cannot load Temporal's native worker, so it keeps the in-process adapter, and Node
   * gets the durable one. There is deliberately no `WORKFLOW_ENGINE` env var; pinning an engine
   * is a composition-root decision, not a deployment knob, and this field is the way a caller
   * (a test, a Worker process) makes it.
   */
  engine?: WorkflowEngineName
}

/** Which `EventBus` adapter `bootstrapContainer` wires. */
export type EventBusAdapterName = 'inline' | 'cloudflare-queues' | 'temporal'

export type EventBusConfig = {
  /**
   * Left unset, the composition root derives the adapter from `RUNTIME`, the same way it derives
   * the workflow engine and for the same reason: workerd cannot load Temporal's native worker and
   * Cloudflare Queues do not exist off it, so the transport is not a deployment knob and there is
   * deliberately no `EVENT_BUS` env var.
   *
   * The node roots take the derived answer now — `temporal-adapter.ts` exists. workerd still pins
   * `inline` because Cloudflare Queues is the remaining ticket, and the test container pins it for
   * the reason the workflow suite pins `simple`: `RUNTIME` is `node` under vitest, and `npm test`
   * must not need a running server.
   */
  adapter?: EventBusAdapterName
}

export type ProjectConfig = {
  http: HttpConfig
  workflows: WorkflowsConfig
  eventBus: EventBusConfig
}

export type ConfigModule = {
  projectConfig: ProjectConfig
  featureFlags: Record<string, boolean | string | Record<string, boolean>>
}

export type InputConfig = {
  projectConfig?: {
    http?: Partial<HttpConfig>
    workflows?: Partial<WorkflowsConfig>
    eventBus?: Partial<EventBusConfig>
  }
  featureFlags?: Record<string, boolean | string | Record<string, boolean>>
}
