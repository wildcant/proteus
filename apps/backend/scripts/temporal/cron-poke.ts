import { Client, Connection } from '@temporalio/client'
import { env } from '../../src/env.js'
import { cronScheduleId } from '../../src/framework/scheduler/temporal/temporal-cron-scheduler.js'

/** Scratch: describe a cron Schedule, optionally trigger it, and report the run's outcome. */
const jobName = process.argv[2] ?? 'product-census'
const shouldTrigger = process.argv.includes('--trigger')

const connection = await Connection.connect({ address: env.TEMPORAL_ADDRESS })
const client = new Client({ connection, namespace: env.TEMPORAL_NAMESPACE })
const handle = client.schedule.getHandle(cronScheduleId(jobName))

const before = await handle.describe()
console.info(`schedule: ${before.scheduleId}`)
console.info(`  paused: ${before.state.paused}`)
console.info(`  action: ${JSON.stringify(before.action)}`)
console.info(`  spec:   ${JSON.stringify(before.spec.calendars?.[0])}`)
console.info(`  taken:  ${before.info.numActionsTaken}`)

if (shouldTrigger) {
  const count = before.info.recentActions.length
  await handle.trigger()

  const deadline = Date.now() + 20_000
  let action = before.info.recentActions.at(-1)
  for (;;) {
    const actions = (await handle.describe()).info.recentActions
    if (actions.length > count) {
      action = actions.at(-1)
      break
    }
    if (Date.now() > deadline) throw new Error('no action recorded after trigger()')
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  if (!action) throw new Error('no action')

  const { workflowId, firstExecutionRunId } = action.action.workflow
  console.info(`\ntriggered run ${workflowId}`)
  await client.workflow
    .getHandle(workflowId, firstExecutionRunId)
    .result()
    .then(() => console.info('  outcome: COMPLETED'))
    .catch((error: unknown) => {
      console.info('  outcome: FAILED')
      let link: unknown = error
      for (let depth = 0; link instanceof Error && depth < 8; depth += 1) {
        console.info(`    ${'  '.repeat(depth)}${link.constructor.name}: ${link.message}`)
        link = link.cause
      }
    })

  const after = await handle.describe()
  console.info(`
after the run — paused: ${after.state.paused}`)
  console.info(`  note: ${after.state.note ?? '(none)'}`)
}

await connection.close()
