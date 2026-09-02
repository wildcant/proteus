import { Client, Connection } from '@temporalio/client'
import { env } from '../env.js'
import { PAYLOAD_CONVERTER_PATH } from './config.js'

export type TemporalClientHandle = {
  client: Client
  close: () => Promise<void>
}

/**
 * Client-side gRPC connection to the Temporal frontend. Separate from the Worker's
 * `NativeConnection`: this one is used to start and await workflows, the Worker's is used to poll.
 *
 * Carries the same payload converter the Worker does, and has to: the client encodes the driver's
 * input and decodes the workflow's result, so a mismatch here would hand a route handler a
 * `CartDTO` whose `createdAt` is a string and whose `unitPrice` is a `{s,e,c}` object.
 */
export async function createTemporalClient(): Promise<TemporalClientHandle> {
  const connection = await Connection.connect({ address: env.TEMPORAL_ADDRESS })
  const client = new Client({
    connection,
    namespace: env.TEMPORAL_NAMESPACE,
    dataConverter: { payloadConverterPath: PAYLOAD_CONVERTER_PATH },
  })

  return { client, close: () => connection.close() }
}
