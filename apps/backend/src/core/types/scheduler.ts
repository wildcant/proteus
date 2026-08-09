import type { AwilixContainer } from 'awilix'
import type { CronExpression } from './cron-expression.js'

export type JobHandler = (container: AwilixContainer) => Promise<void> | void

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
  /** Syncs job definitions against the backing store and starts the worker. */
  start(jobs: JobDefinition[]): Promise<void>
  shutdown(): Promise<void>
  /** Returns framework-specific middleware for the scheduler's monitoring UI. */
  mountMonitor(): unknown
}
