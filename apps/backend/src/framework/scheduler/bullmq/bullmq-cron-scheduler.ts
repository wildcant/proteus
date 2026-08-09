import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'
import type { ApplicationLifecycle } from '@core/types/lifecycle.js'
import type { Logger } from '@core/types/logger.js'
import type { CronScheduler, JobDefinition, JobHandler } from '@core/types/scheduler.js'
import type { AwilixContainer } from 'awilix'
import {
  createPostgresBackend,
  type PostgresQueueBackend,
  Queue,
  type QueueOptions,
  Worker,
  type WorkerOptions,
} from 'bullmq'
import { env } from '../../../env.js'

const QUEUE_NAME = 'proteus-cron-jobs'

// BullMQ types define `connection` as Redis-only, but `createPostgresBackend`
// accepts a Postgres URL at runtime. This helper bridges the typing gap.
function postgresOptions(databaseUrl: string): QueueOptions & WorkerOptions {
  // @ts-expect-error -- BullMQ Postgres backend accepts a URL string, not a Redis connection
  return { connection: databaseUrl }
}

// BullMQ Queue/Worker default their backend type param to RedisQueueBackend.
// When using createPostgresBackend, we need to parameterize with PostgresQueueBackend.
type PostgresQueue = Queue<unknown, unknown, string, unknown, unknown, string, PostgresQueueBackend>
type PostgresWorker = Worker<unknown, unknown, string, PostgresQueueBackend>

/**
 * BullMQ-backed cron scheduler.
 *
 * Concurrency note: BullMQ repeatable jobs don't overlap by default — the next
 * tick won't fire while the previous run is in-flight. This is the desired
 * "forbid" behavior. It matters because a slow job that exceeds its interval
 * could cause double-processing without this protection.
 */
export class BullMqCronScheduler implements CronScheduler, ApplicationLifecycle {
  readonly queue: PostgresQueue
  private worker: PostgresWorker | undefined
  private readonly handlers = new Map<string, JobHandler>()

  constructor(
    private readonly logger: Logger,
    private readonly container: AwilixContainer,
  ) {
    this.queue = new Queue(QUEUE_NAME, postgresOptions(env.DIRECT_DATABASE_URL), createPostgresBackend)
  }

  async onApplicationStart(): Promise<void> {
    await this.start()
  }

  async onApplicationPrepareShutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close()
    }
  }

  queueName(): string {
    return QUEUE_NAME
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close()
  }

  async shutdown(): Promise<void> {
    await this.onApplicationPrepareShutdown()
    await this.onApplicationShutdown()
  }

  async schedule(job: JobDefinition): Promise<void> {
    this.handlers.set(job.name, job.handler)

    await this.queue.upsertJobScheduler(
      `cron_${job.name}`,
      { pattern: job.schedule },
      {
        name: job.name,
        data: { jobName: job.name },
        opts: {
          removeOnComplete: { age: 86400, count: 1000 },
          removeOnFail: { age: 604800, count: 5000 },
        },
      },
    )
  }

  async remove(jobName: string): Promise<void> {
    await this.queue.removeJobScheduler(`cron_${jobName}`)
    this.handlers.delete(jobName)
  }

  async start(): Promise<void> {
    this.worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        const data: unknown = job.data
        if (data === null || typeof data !== 'object' || !('jobName' in data) || typeof data.jobName !== 'string') {
          this.logger.error('[CronScheduler] Job received with invalid data payload')
          return
        }
        const jobName = data.jobName
        const handler = this.handlers.get(jobName)
        if (!handler) {
          this.logger.warn(`[CronScheduler] No handler registered for job "${jobName}"`)
          return
        }

        try {
          await handler(this.container)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          this.logger.error(`[CronScheduler] Job "${jobName}" failed: ${message}`)
          throw error
        }
      },
      postgresOptions(env.DIRECT_DATABASE_URL),
      createPostgresBackend,
    )
  }

  mountMonitor() {
    const adapter = new ExpressAdapter()
    adapter.setBasePath('/admin/queues')
    createBullBoard({
      // BullMQAdapter expects a Redis-typed Queue, but the runtime queue is Postgres-backed.
      // BullMQ's Queue class is the same at runtime regardless of backend type param.
      // @ts-expect-error -- PostgresQueue is structurally compatible at runtime
      queues: [new BullMQAdapter(this.queue)],
      serverAdapter: adapter,
    })
    return adapter.getRouter()
  }
}
