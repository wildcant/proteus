import { Client, Connection } from '@temporalio/client'
import { env } from '../../src/env.js'

const connection = await Connection.connect({ address: env.TEMPORAL_ADDRESS })
const client = new Client({ connection, namespace: env.TEMPORAL_NAMESPACE })

for await (const execution of client.workflow.list({ query: `WorkflowType = 'cronJobWorkflow'` })) {
  const when = execution.startTime.toISOString().slice(11, 19)
  console.info(`${when}  ${execution.status.name.padEnd(9)}  ${execution.workflowId}`)
}
await connection.close()
