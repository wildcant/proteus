import type { PreparedRoute, RouteHandler } from '@server/ports.js'
import type { TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import request from 'supertest'
import { createExpressApp } from '../express/app.js'
import { createHonoApp } from '../hono/app.js'

/**
 * Echoes back what the adapter handed the handler. Base64 because the point is the bytes: a
 * string comparison after a decode would hide exactly the kind of re-encoding this is here to
 * catch.
 */
const routes: PreparedRoute[] = [
  {
    method: 'POST',
    matcher: '/echo',
    // Cast as in applyMiddleware: RouteHandler's generic response type is not satisfiable by a
    // handler returning one concrete shape.
    handler: ((req) =>
      Promise.resolve({
        status: 200,
        json: {
          raw: req.rawBody ? Buffer.from(req.rawBody).toString('base64') : null,
          body: req.body ?? null,
        },
      })) as RouteHandler,
  },
]

/**
 * A payload no re-serialisation reproduces: indented, and carrying an escape sequence that
 * `JSON.parse` collapses into the character it names. Both survive only if the bytes do.
 */
const PAYLOAD = '{\n  "note": "caf\\u00e9",\n  "amount": 1999\n}'

const bytes = Buffer.from(PAYLOAD, 'utf8')

const multipartRequest = () => {
  const formData = new FormData()
  formData.append('files', new File(['a'], 'a.txt', { type: 'text/plain' }))
  return new Request('http://localhost/echo', { method: 'POST', body: formData })
}

type Echo = { raw: string | null; body: unknown }

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi()
})

test.describe('raw request bytes', () => {
  test('the payload is not what a re-serialisation of it produces', ({ expect }) => {
    // Guards the two tests below: if this ever became true the assertions would still pass while
    // proving nothing, because a re-serialised body would be byte-identical to the sent one.
    expect(JSON.stringify(JSON.parse(PAYLOAD))).not.toBe(PAYLOAD)
  })

  test('express hands the handler the transmitted bytes, unmodified', async ({ logger, expect }) => {
    const app = createExpressApp({ routes, container: api.container, logger, corsOrigins: [] })

    // The string, not the Buffer: supertest serialises a Buffer sent as `application/json` into
    // `{"type":"Buffer","data":[…]}`, which would be the test's own re-encoding rather than the
    // adapter's. A string is written to the socket verbatim.
    const response = await request(app).post('/echo').set('Content-Type', 'application/json').send(PAYLOAD)
    const echo = response.body as Echo

    expect(echo.raw).toBe(bytes.toString('base64'))
    // And the parsed body is still there — the raw bytes are carried alongside it, not instead.
    expect(echo.body).toEqual({ note: 'café', amount: 1999 })
  })

  test('hono hands the handler the transmitted bytes, unmodified', async ({ logger, expect }) => {
    const app = createHonoApp({ routes, container: api.container, logger, corsOrigins: [] })

    const response = await app.fetch(
      new Request('http://localhost/echo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: bytes,
      }),
    )
    const echo = (await response.json()) as Echo

    expect(echo.raw).toBe(bytes.toString('base64'))
    expect(echo.body).toEqual({ note: 'café', amount: 1999 })
  })

  test('express leaves a multipart upload out of the raw bytes', async ({ logger, expect }) => {
    const app = createExpressApp({ routes, container: api.container, logger, corsOrigins: [] })
    const multipart = multipartRequest()

    const response = await request(app)
      .post('/echo')
      .set('Content-Type', multipart.headers.get('content-type') ?? '')
      .send(Buffer.from(await multipart.arrayBuffer()))

    // An upload is streamed to `req.files`; buffering it a second time would double the memory
    // cost of every file the store accepts.
    expect((response.body as Echo).raw).toBeNull()
  })

  test('hono leaves a multipart upload out of the raw bytes', async ({ logger, expect }) => {
    const app = createHonoApp({ routes, container: api.container, logger, corsOrigins: [] })

    const response = await app.fetch(multipartRequest())

    expect(((await response.json()) as Echo).raw).toBeNull()
  })
})
