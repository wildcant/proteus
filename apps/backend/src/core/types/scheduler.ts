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
   * Syncs job definitions against the backing store, in both directions: this list is the desired
   * state, so a job that is gone from it has its schedule removed rather than left behind.
   *
   * Called by the process that *runs* the jobs, at boot, from the same list it resolves handlers
   * from. That is what makes removal safe, and what makes "a schedule exists" and "something can
   * run it" one fact instead of two — see ADR-0029.
   */
  start(jobs: JobDefinition[]): Promise<void>
  shutdown(): Promise<void>
}
