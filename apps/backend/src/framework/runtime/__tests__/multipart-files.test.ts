import type { PreparedRoute, RouteHandler } from '@server/ports.js'
import type { TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import request from 'supertest'
import { createExpressApp } from '../express/app.js'
import { createHonoApp } from '../hono/app.js'

// Echoes back whatever the adapter parsed into `req.files`, so the assertions
// below are about field-name filtering rather than any upload behaviour.
const routes: PreparedRoute[] = [
  {
    method: 'POST',
    matcher: '/uploads',
    // Cast as in applyMiddleware: RouteHandler's generic response type is not
    // satisfiable by a handler returning one concrete shape.
    handler: ((req) =>
      Promise.resolve({ status: 200, json: { names: (req.files ?? []).map((file) => file.name) } })) as RouteHandler,
  },
]

const formDataWithMixedFields = () => {
  const formData = new FormData()
  formData.append('files', new File(['a'], 'a.txt', { type: 'text/plain' }))
  formData.append('attachments', new File(['b'], 'b.txt', { type: 'text/plain' }))
  return formData
}

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi()
})

test.describe('multipart file parsing', () => {
  test('express adapter only accepts the files field', async ({ logger, expect }) => {
    const app = createExpressApp({ routes, container: api.container, logger, corsOrigins: [] })

    const webRequest = new Request('http://localhost/uploads', { method: 'POST', body: formDataWithMixedFields() })
    const body = Buffer.from(await webRequest.arrayBuffer())

    const response = await request(app)
      .post('/uploads')
      .set('Content-Type', webRequest.headers.get('content-type') ?? '')
      .send(body)

    expect(response.body).toEqual({ names: ['a.txt'] })
  })

  test('hono adapter only accepts the files field', async ({ logger, expect }) => {
    const app = createHonoApp({ routes, container: api.container, logger, corsOrigins: [] })

    const response = await app.fetch(
      new Request('http://localhost/uploads', { method: 'POST', body: formDataWithMixedFields() }),
    )

    expect(await response.json()).toEqual({ names: ['a.txt'] })
  })
})
