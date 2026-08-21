import { test } from '@tests/setup/test-extend.js'
import { z } from 'zod'
import { applyMiddleware } from '../apply-middleware.js'
import type { MiddlewareFunction, RouteDefinition } from '../types.js'
import { Tags } from '../types.js'

test.describe('applyMiddleware', () => {
  test('validates path params through input.params', async ({ makeRequest, expect }) => {
    const definition: RouteDefinition = {
      method: 'GET',
      matcher: '/admin/users/:id',
      handler: (req) => Promise.resolve({ status: 200, json: { id: req.params.id } }),
      input: { params: z.object({ id: z.string().startsWith('usr_') }) },
      operationId: 'test',
      tags: [Tags.USERS],
      output: z.object({ id: z.string() }),
    }

    const handler = applyMiddleware(definition)

    const result = await handler(makeRequest({ params: { id: 'usr_123' } }))
    expect(result.json).toEqual({ id: 'usr_123' })
  })

  test('rejects invalid path params', async ({ makeRequest, expect }) => {
    const definition: RouteDefinition = {
      method: 'GET',
      matcher: '/admin/users/:id',
      handler: () => Promise.resolve({ status: 200, json: {} }),
      input: { params: z.object({ id: z.string().startsWith('usr_') }) },
      operationId: 'test',
      tags: [Tags.USERS],
      output: z.object({}),
    }

    const handler = applyMiddleware(definition)

    await expect(handler(makeRequest({ params: { id: 'bad' } }))).rejects.toThrow('Invalid path params')
  })

  test('validates request body through input.body', async ({ makeRequest, expect }) => {
    const definition: RouteDefinition = {
      method: 'POST',
      matcher: '/admin/users',
      handler: (req) => Promise.resolve({ status: 200, json: { email: (req.body as { email: string }).email } }),
      input: { body: z.object({ email: z.string().email() }) },
      operationId: 'test',
      tags: [Tags.USERS],
      output: z.object({ email: z.string() }),
    }

    const handler = applyMiddleware(definition)

    const result = await handler(makeRequest({ body: { email: 'test@example.com' } }))
    expect(result.json).toEqual({ email: 'test@example.com' })
  })

  test('rejects invalid request body', async ({ makeRequest, expect }) => {
    const definition: RouteDefinition = {
      method: 'POST',
      matcher: '/admin/users',
      handler: () => Promise.resolve({ status: 200, json: {} }),
      input: { body: z.object({ email: z.string().email() }) },
      operationId: 'test',
      tags: [Tags.USERS],
      output: z.object({}),
    }

    const handler = applyMiddleware(definition)

    await expect(handler(makeRequest({ body: { email: 'not-an-email' } }))).rejects.toThrow('Invalid request body')
  })

  test('validates response through output', async ({ makeRequest, expect }) => {
    const definition: RouteDefinition = {
      method: 'GET',
      matcher: '/admin/users',
      handler: () => Promise.resolve({ status: 200, json: { name: 'Alice', extra: 'field' } }),
      operationId: 'test',
      tags: [Tags.USERS],
      output: z.object({ name: z.string() }),
    }

    const handler = applyMiddleware(definition)

    const result = await handler(makeRequest())
    // output.parse strips unknown keys
    expect(result.json).toEqual({ name: 'Alice' })
  })

  test('runs middlewares in order before handler', async ({ makeRequest, expect }) => {
    const order: string[] = []

    const middleware1: MiddlewareFunction = (req) => {
      order.push('middleware1')
      return req
    }
    const middleware2: MiddlewareFunction = (req) => {
      order.push('middleware2')
      return req
    }

    const definition: RouteDefinition = {
      method: 'GET',
      matcher: '/admin/users',
      handler: () => {
        order.push('handler')
        return Promise.resolve({ status: 200, json: {} })
      },
      middlewares: [middleware1, middleware2],
      operationId: 'test',
      tags: [Tags.USERS],
      output: z.object({}),
    }

    const handler = applyMiddleware(definition)
    await handler(makeRequest())

    expect(order).toEqual(['middleware1', 'middleware2', 'handler'])
  })

  test('auth middleware from namespace runs before custom middleware', async ({ makeRequest, expect }) => {
    const order: string[] = []

    const authMiddleware: MiddlewareFunction = (req) => {
      order.push('auth')
      return req
    }
    const customMiddleware: MiddlewareFunction = (req) => {
      order.push('custom')
      return req
    }

    const definition: RouteDefinition = {
      method: 'GET',
      matcher: '/admin/users',
      handler: () => {
        order.push('handler')
        return Promise.resolve({ status: 200, json: {} })
      },
      // Simulates what applyNamespaceAuth does: auth is prepended before custom
      middlewares: [authMiddleware, customMiddleware],
      operationId: 'test',
      tags: [Tags.USERS],
      output: z.object({}),
    }

    const handler = applyMiddleware(definition)
    await handler(makeRequest())

    expect(order).toEqual(['auth', 'custom', 'handler'])
  })
})
