import { Client, Connection } from '@temporalio/client'
import { noopLogger } from '../../src/core/logger/noop-logger.js'
import { CronExpression } from '../../src/core/types/cron-expression.js'
import type { JobDefinition } from '../../src/core/types/scheduler.js'
import { env } from '../../src/env.js'
import {
  cronScheduleId,
  TemporalCronScheduler,
} from '../../src/framework/scheduler/temporal/temporal-cron-scheduler.js'

/** Scratch: what does a Schedule whose job no longer exists actually cost, left alone? */
const orphan: JobDefinition = {
  name: 'orphan-probe',
  schedule: CronExpression.EVERY_MINUTE,
  handler: () => undefined,
}

const scheduler = new TemporalCronScheduler({ logger: noopLogger })
const connection = await Connection.connect({ address: env.TEMPORAL_ADDRESS })
const client = new Client({ connection, namespace: env.TEMPORAL_NAMESPACE })
const handle = client.schedule.getHandle(cronScheduleId(orphan.name))

try {
  await scheduler.schedule(orphan)
  console.info('created, enabled, every minute — and no Worker has this job. Waiting for a real tick.')

  const deadline = Date.now() + 180_000
  for (;;) {
    const description = await handle.describe()
    if (description.state.paused) {
      console.info(`\nPAUSED BY THE SERVER after ${description.info.numActionsTaken} scheduled run(s)`)
      console.info(`  note: ${description.state.note}`)
      break
    }
    if (Date.now() > deadline) {
      console.info(
        `\nstill running after 3 min, ${description.info.numActionsTaken} action(s) — pauseOnFailure did NOT fire`,
      )
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  // The API boots with a job list that no longer names it. Does reconciliation touch it?
  await scheduler.start([])
  const reconciled = await handle.describe()
  console.info(`after start([]) — paused = ${reconciled.state.paused}, actions = ${reconciled.info.numActionsTaken}`)
} finally {
  await scheduler.remove(orphan.name)
  await scheduler.shutdown()
  await connection.close()
}
