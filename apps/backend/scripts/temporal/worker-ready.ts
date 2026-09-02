import { Connection } from '@temporalio/client'
import { env } from '../../src/env.js'
import { TEMPORAL_TASK_QUEUE } from '../../src/temporal/config.js'

/**
 * Readiness probe for the `worker` service in `docker-compose.yml`.
 *
 * It asks Temporal the only question that matters — *is anything polling the `proteus` task queue?*
 * — rather than whether a process exists. Those differ in the case that actually bites: a Worker
 * that booted, failed to connect, and is retrying. `docker compose up -d --wait` returns when this
 * passes, so a workflow route served by `npm run dev` has somewhere to run by the time it does.
 *
 * `describeTaskQueue` defaults to the workflow queue, which is the one the driver's tasks land on;
 * a Worker polls it and the activity queue together, so one is enough to answer the question.
 */
const connection = await Connection.connect({ address: env.TEMPORAL_ADDRESS })

try {
  const { pollers } = await connection.workflowService.describeTaskQueue({
    namespace: env.TEMPORAL_NAMESPACE,
    taskQueue: { name: TEMPORAL_TASK_QUEUE },
  })

  if (!pollers?.length) {
    // The exit code is what Docker reads; this line is what a human reads in `docker inspect`.
    console.info(`[worker-ready] nothing is polling '${TEMPORAL_TASK_QUEUE}' on ${env.TEMPORAL_ADDRESS}`)
    process.exitCode = 1
  } else {
    console.info(`[worker-ready] ${pollers.length} poller(s) on '${TEMPORAL_TASK_QUEUE}'`)
  }
} finally {
  await connection.close()
}
