import { createServer, type Server } from 'node:http'
import {
  advanceIntent,
  callsSince,
  type FakeIntentStatus,
  getIntent,
  getIntentForSession,
} from './stripe-gateway-state.js'

/**
 * The fake gateway's control surface, over HTTP.
 *
 * MSW intercepts what the backend *sends*; nothing else in the process can see the result. Two
 * readers need to:
 *
 * - the browser's fake Stripe.js, which confirms a payment and must move the same intent the
 *   server will later authorize — otherwise the e2e proves nothing about the sequence;
 * - the Playwright specs, which assert against the gateway's own call log rather than inferring
 *   "no PaymentIntent exists yet" from the UI.
 *
 * It lives in `tests/` and is started only under `MOCKS=true`, so no route of the real API exists
 * for it and production route discovery never sees it.
 */
export const FAKE_GATEWAY_PORT = 3012

const CORS_HEADERS = {
  // The storefront's fake Stripe.js calls this from another origin. Test-only server, no data.
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
}

function json(body: unknown, status = 200) {
  return { status, body: JSON.stringify(body) }
}

async function readJson(request: import('node:http').IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
}

async function route(request: import('node:http').IncomingMessage, url: URL) {
  // The gateway's call log from a watermark. Specs read the watermark before the payment step
  // renders and again after, so a neighbouring spec's calls cannot be mistaken for their own.
  if (request.method === 'GET' && url.pathname === '/calls') {
    return json(callsSince(Number(url.searchParams.get('since') ?? 0)))
  }

  // By session id, because the create call records what was sent rather than what came back —
  // which is the same way the adapter links an intent back to a session.
  if (request.method === 'GET' && url.pathname === '/intents') {
    const intent = getIntentForSession(url.searchParams.get('sessionId') ?? '')
    return intent ? json(intent) : json({ error: 'no intent for that session' }, 404)
  }

  const intentMatch = url.pathname.match(/^\/intents\/([^/]+)$/)
  if (request.method === 'GET' && intentMatch?.[1]) {
    const intent = getIntent(intentMatch[1])
    return intent ? json(intent) : json({ error: 'no such intent' }, 404)
  }

  const confirmMatch = url.pathname.match(/^\/intents\/([^/]+)\/confirm$/)
  if (request.method === 'POST' && confirmMatch?.[1]) {
    const body = await readJson(request)
    const intent = advanceIntent(
      confirmMatch[1],
      body.status as FakeIntentStatus,
      (body.lastPaymentError as never) ?? null,
    )
    return intent ? json(intent) : json({ error: 'no such intent' }, 404)
  }

  return json({ error: 'not found' }, 404)
}

export function startFakeGatewayServer(): Server {
  const server = createServer((request, response) => {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, CORS_HEADERS).end()
      return
    }

    const url = new URL(request.url ?? '/', `http://localhost:${FAKE_GATEWAY_PORT}`)
    route(request, url)
      .then(({ status, body }) => {
        response.writeHead(status, { ...CORS_HEADERS, 'content-type': 'application/json' }).end(body)
      })
      .catch((error: unknown) => {
        response
          .writeHead(500, { ...CORS_HEADERS, 'content-type': 'application/json' })
          .end(JSON.stringify({ error: String(error) }))
      })
  })

  server.listen(FAKE_GATEWAY_PORT)
  return server
}
