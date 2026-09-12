import { Connection } from '@temporalio/client'
import { env } from '../../src/env.js'
import { CRON_TASK_QUEUE } from '../../src/framework/scheduler/temporal/config.js'

/**
 * Readiness probe for the Worker services in `docker-compose.yml`.
 *
 * It asks Temporal the only question that matters — *is anything polling this task queue?* — rather
 * than whether a process exists. Those differ in the case that actually bites: a Worker that booted,
 * failed to connect, and is retrying. `docker compose up -d --wait` returns when this passes, so a
 * workflow route served by `pnpm dev` has somewhere to run by the time it does, and a Schedule that
 * fires has somewhere to run its driver.
 *
 * The optional argument names **which Worker** to ask about, not which queue: a compose healthcheck
 * spelling the queue out would be a second copy of a constant whose entire purpose is that the
 * process creating the work and the process polling for it agree. With no argument it is the
 * workflow queue, which is how the `worker` service has always called this.
 *
 * `events-worker` deliberately has no healthcheck and so no entry here — nothing in the stack waits
 * on it, and it registers no workflow, so it is polling within a second of starting.
 *
 * `describeTaskQueue` defaults to the workflow queue kind, which is the one a driver's tasks land
 * on; a Worker polls it and the activity queue together, so one is enough to answer the question.
 */
const QUEUES = {
  workflow: env.TEMPORAL_TASK_QUEUE,
  cron: CRON_TASK_QUEUE,
} satisfies Record<string, string>

const requested = process.argv[2] ?? 'workflow'

if (!Object.hasOwn(QUEUES, requested)) {
  // Exit 2 rather than 1: "you asked the wrong question" is not "the Worker is not ready", and a
  // healthcheck that retries a typo for a minute before failing hides which of the two happened.
  console.info(`[worker-ready] unknown worker "${requested}" — expected one of ${Object.keys(QUEUES).join(', ')}`)
  process.exit(2)
}

const taskQueue = QUEUES[requested as keyof typeof QUEUES]

const connection = await Connection.connect({ address: env.TEMPORAL_ADDRESS })

try {
  const { pollers } = await connection.workflowService.describeTaskQueue({
    namespace: env.TEMPORAL_NAMESPACE,
    taskQueue: { name: taskQueue },
  })

  if (!pollers?.length) {
    // The exit code is what Docker reads; this line is what a human reads in `docker inspect`.
    console.info(`[worker-ready] nothing is polling '${taskQueue}' on ${env.TEMPORAL_ADDRESS}`)
    process.exitCode = 1
  } else {
    console.info(`[worker-ready] ${pollers.length} poller(s) on '${taskQueue}'`)
  }
} finally {
  await connection.close()
}
