import type { ActorType } from '@proteus/http-schemas/auth'

type HttpConfig = {
  authMethodsPerActor: Partial<Record<ActorType, string[]>>
  authVerificationsPerActor: Partial<Record<ActorType, { entityType: string; authProvider: string }[]>>
}

/** Which `WorkflowEngine` adapter `bootstrapContainer` wires. */
export type WorkflowEngineName = 'simple' | 'temporal'

type WorkflowsConfig = {
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

type EventBusConfig = {
  /**
   * Left unset, the composition root derives the adapter from `RUNTIME`, the same way it derives
   * the workflow engine and for the same reason: workerd cannot load Temporal's native worker and
   * Cloudflare Queues do not exist off it, so the transport is not a deployment knob and there is
   * deliberately no `EVENT_BUS` env var.
   *
   * Both transports exist, so this is no longer a pin with a date on it. The node roots leave it
   * unset and take the derived answer; the workerd root names the one it derives anyway, so a
   * deploy's transport reads next to the wiring that supplies its binding; a Worker process states
   * it because all three Workers share one composition root and none should inherit another's choice.
   * The test container is the only caller pinning something a runtime would not derive — `inline`,
   * for the reason the workflow suite pins `simple`: `RUNTIME` is `node` under vitest, and
   * `pnpm test` must not need a running server.
   */
  adapter?: EventBusAdapterName
}

/** The payment gateways a store can turn on. Each one needs its keys in the environment once on. */
type PaymentProviderName = 'stripe'

/** The email services a store can turn on. Each one needs its keys in the environment once on. */
type NotificationProviderName = 'resend'

/**
 * The optional integrations this store uses. A store that sells without card payments or sends no
 * email leaves them out, and then needs none of their keys. The built-in providers (the system
 * payment provider, the in-app notification feed, manual fulfillment) are always on.
 */
type ProvidersConfig = {
  payment: PaymentProviderName[]
  notification: NotificationProviderName[]
}

type ProjectConfig = {
  http: HttpConfig
  workflows: WorkflowsConfig
  eventBus: EventBusConfig
  providers: ProvidersConfig
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
    providers?: Partial<ProvidersConfig>
  }
  featureFlags?: Record<string, boolean | string | Record<string, boolean>>
}
