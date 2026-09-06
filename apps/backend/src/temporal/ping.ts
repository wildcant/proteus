import { ulid } from 'ulid'
import { TEMPORAL_TASK_QUEUE } from '../core/workflows/temporal/config.js'
import { pingWorkflow } from '../core/workflows/temporal/workflows.js'
import { createTemporalClient } from './client.js'

/**
 * Round-trip probe — `npm run --workspace=backend temporal:ping`.
 *
 * Starts `pingWorkflow` on the shared task queue and waits for it, so a successful run proves the
 * whole path: client → frontend → task queue → Worker → activity → history. Needs a Worker running.
 */
const { client, close } = await createTemporalClient()

try {
  const workflowId = `ping-${ulid()}`

  const output = await client.workflow.execute(pingWorkflow, {
    taskQueue: TEMPORAL_TASK_QUEUE,
    workflowId,
    args: ['proteus'],
  })

  console.info(`[temporal-ping] ${workflowId} -> ${output}`)
} finally {
  await close()
}
