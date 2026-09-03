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

export type ProjectConfig = {
  http: HttpConfig
  workflows: WorkflowsConfig
}

export type ConfigModule = {
  projectConfig: ProjectConfig
  featureFlags: Record<string, boolean | string | Record<string, boolean>>
}

export type InputConfig = {
  projectConfig?: {
    http?: Partial<HttpConfig>
    workflows?: Partial<WorkflowsConfig>
  }
  featureFlags?: Record<string, boolean | string | Record<string, boolean>>
}
