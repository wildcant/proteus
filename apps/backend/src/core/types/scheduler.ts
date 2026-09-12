import type { AwilixContainer } from 'awilix'
import type { CronExpression } from './cron-expression.js'

/**
 * Not exported: `JobDefinition` is the whole surface, and the deleted queue adapter — which held
 * its own map of handlers — was the only thing that ever named this on its own.
 */
type JobHandler = (container: AwilixContainer) => Promise<void> | void

export type JobDefinition = {
  name: string
  schedule: `${CronExpression}`
  handler: JobHandler
  disabled?: boolean
}

export type CronScheduler = {
  queueName(): string
  schedule(job: JobDefinition): Promise<void>
  remove(jobName: string): Promise<void>
  /**
   * Syncs job definitions against the backing store. Whether anything is *running* them is a
   * separate process's business — the cron Worker's — so this returning cleanly says the schedules
   * exist, not that a tick will be picked up.
   */
  start(jobs: JobDefinition[]): Promise<void>
  shutdown(): Promise<void>
}
