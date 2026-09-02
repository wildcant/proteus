import type { ActorType } from '@proteus/http-schemas/auth'
import type { DeferredTasksConfig } from '../utils/deferred-tasks.js'

export type HttpConfig = {
  authMethodsPerActor: Partial<Record<ActorType, string[]>>
  authVerificationsPerActor: Partial<Record<ActorType, { entityType: string; authProvider: string }[]>>
}

export type ProjectConfig = {
  http: HttpConfig
  /** How long incoming webhooks wait before they are processed, and how often a failure is retried. */
  webhooks: DeferredTasksConfig
}

export type ConfigModule = {
  projectConfig: ProjectConfig
  featureFlags: Record<string, boolean | string | Record<string, boolean>>
}

export type InputConfig = {
  projectConfig?: {
    http?: Partial<HttpConfig>
    webhooks?: Partial<DeferredTasksConfig>
  }
  featureFlags?: Record<string, boolean | string | Record<string, boolean>>
}
