import { parseArgs } from 'node:util'
import { env } from './env.js'
import { start } from './start.js'

if (env.MOCKS) {
  const { server, onUnhandledRequest, startFakeGatewayServer } = await import('../tests/mocks/server.js')
  server.listen({ onUnhandledRequest })
  console.info('[MSW] MSW server listening — mocking third-party APIs')

  // The gateway's call log and intent store, over HTTP. MSW can only intercept what this process
  // sends; the browser's fake Stripe.js and the Playwright specs have to read the same state.
  startFakeGatewayServer()
  console.info('[MSW] Fake payment gateway control server listening on :3012')
}

const { values } = parseArgs({ options: { port: { type: 'string' } }, strict: false })

await start(values.port ? { port: Number(values.port) } : undefined)
