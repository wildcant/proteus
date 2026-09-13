import { Client, Connection } from '@temporalio/client'
import { env } from '../../src/env.js'

const scheduleId = process.argv[2] ?? 'cron_product-census'
const connection = await Connection.connect({ address: env.TEMPORAL_ADDRESS })
const client = new Client({ connection, namespace: env.TEMPORAL_NAMESPACE })

if (process.argv.includes('--delete')) {
  await client.schedule.getHandle(scheduleId).delete()
  console.info(`deleted schedule ${scheduleId}\n`)
}

const exists = await client.schedule
  .getHandle(scheduleId)
  .describe()
  .then(() => true)
  .catch(() => false)
console.info(`schedule ${scheduleId} exists: ${exists}`)

console.info(`runs still queryable by TemporalScheduledById = '${scheduleId}':`)
for await (const execution of client.workflow.list({ query: `TemporalScheduledById = '${scheduleId}'` })) {
  console.info(`  ${execution.startTime.toISOString().slice(11, 19)}  ${execution.status.name}`)
}

const { namespaceInfo, config } = await connection.workflowService.describeNamespace({
  namespace: env.TEMPORAL_NAMESPACE,
})
console.info(`\nnamespace ${namespaceInfo?.name}: retention = ${config?.workflowExecutionRetentionTtl?.seconds}s`)
console.info(
  `  history archival: ${config?.historyArchivalState}  visibility archival: ${config?.visibilityArchivalState}`,
)
await connection.close()
