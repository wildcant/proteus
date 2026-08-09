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
  start(): Promise<void>
  shutdown(): Promise<void>
  /** Returns framework-specific middleware for the scheduler's monitoring UI. */
  mountMonitor(): unknown
}
