import { Client, Connection } from '@temporalio/client'
import { env } from '../env.js'

export type TemporalClientHandle = {
  client: Client
  close: () => Promise<void>
}

/**
 * Client-side gRPC connection to the Temporal frontend. Separate from the Worker's
 * `NativeConnection`: this one is used to start and await workflows, the Worker's is used to poll.
 */
export async function createTemporalClient(): Promise<TemporalClientHandle> {
  const connection = await Connection.connect({ address: env.TEMPORAL_ADDRESS })
  const client = new Client({ connection, namespace: env.TEMPORAL_NAMESPACE })

  return { client, close: () => connection.close() }
}
