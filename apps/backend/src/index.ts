import { parseArgs } from 'node:util'
import { env } from './env.js'
import { start } from './start.js'

if (env.MOCKS) {
  const { server, onUnhandledRequest } = await import('../tests/mocks/server.js')
  server.listen({ onUnhandledRequest })
  console.info('[MSW] MSW server listening — mocking third-party APIs')
}

const { values } = parseArgs({ options: { port: { type: 'string' } }, strict: false })

await start(values.port ? { port: Number(values.port) } : undefined)
