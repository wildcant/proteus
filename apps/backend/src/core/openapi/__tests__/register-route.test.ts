import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import { test } from '@tests/setup/test-extend.js'
import { z } from 'zod'
import { registerOpenApiRoute } from '../register-route.js'
import { BEARER_SCHEME_NAME, createRegistry, generateDocument } from '../registry.js'

const buildDocument = (definition: RouteDefinition) => {
  const registry = createRegistry()
  registerOpenApiRoute(registry, definition.matcher, definition)
  return generateDocument(registry, { title: 'Test API', description: 'Test API description' })
}

test.describe('registerOpenApiRoute', () => {
  test('registers a JSON request body from input.body', ({ expect }) => {
    const document = buildDocument({
      method: 'POST',
      matcher: '/admin/users',
      handler: () => Promise.resolve({ status: 200, json: {} }),
      input: { body: z.object({ email: z.string() }) },
      operationId: 'createUser',
      tags: [Tags.USERS],
      output: z.object({}),
    })

    const requestBody = document.paths?.['/admin/users']?.post?.requestBody
    expect(requestBody).toHaveProperty('content.application/json')
  })

  test('registers a multipart request body from multipartBody', ({ expect }) => {
    const document = buildDocument({
      method: 'POST',
      matcher: '/admin/uploads',
      handler: () => Promise.resolve({ status: 200, json: {} }),
      multipartBody: z.object({ files: z.array(z.string()) }),
      operationId: 'uploadFiles',
      tags: [Tags.UPLOADS],
      output: z.object({}),
    })

    const requestBody = document.paths?.['/admin/uploads']?.post?.requestBody
    expect(requestBody).toHaveProperty('content.multipart/form-data')
  })

  test('requires the bearer scheme on a route with no explicit auth policy', ({ expect }) => {
    const document = buildDocument({
      method: 'GET',
      matcher: '/admin/users',
      handler: () => Promise.resolve({ status: 200, json: {} }),
      operationId: 'listUsers',
      tags: [Tags.USERS],
      output: z.object({}),
    })

    expect(document.paths?.['/admin/users']?.get?.security).toEqual([{ [BEARER_SCHEME_NAME]: [] }])
  })

  test('requires the bearer scheme on optional and unregistered auth policies', ({ expect }) => {
    for (const auth of ['required', 'optional', 'unregistered'] as const) {
      const document = buildDocument({
        method: 'GET',
        matcher: '/store/carts/:id',
        handler: () => Promise.resolve({ status: 200, json: {} }),
        auth,
        input: { params: z.object({ id: z.string() }) },
        operationId: 'getCart',
        tags: [Tags.CARTS],
        output: z.object({}),
      })

      expect(document.paths?.['/store/carts/{id}']?.get?.security).toEqual([{ [BEARER_SCHEME_NAME]: [] }])
    }
  })

  test('empties security on a public route', ({ expect }) => {
    const document = buildDocument({
      method: 'GET',
      matcher: '/store/products',
      handler: () => Promise.resolve({ status: 200, json: {} }),
      auth: 'public',
      operationId: 'listStoreProducts',
      tags: [Tags.PRODUCTS],
      output: z.object({}),
    })

    expect(document.paths?.['/store/products']?.get?.security).toEqual([])
  })

  test('declares a 401 on an authenticated route', ({ expect }) => {
    const document = buildDocument({
      method: 'GET',
      matcher: '/admin/users',
      handler: () => Promise.resolve({ status: 200, json: {} }),
      operationId: 'listUsers',
      tags: [Tags.USERS],
      output: z.object({}),
    })

    expect(document.paths?.['/admin/users']?.get?.responses).toHaveProperty('401')
  })

  test('omits the 401 on a public route', ({ expect }) => {
    const document = buildDocument({
      method: 'GET',
      matcher: '/store/products',
      handler: () => Promise.resolve({ status: 200, json: {} }),
      auth: 'public',
      operationId: 'listStoreProducts',
      tags: [Tags.PRODUCTS],
      output: z.object({}),
    })

    expect(document.paths?.['/store/products']?.get?.responses).not.toHaveProperty('401')
  })

  test('declares a 401 on a public route that opts in with returnsUnauthorized', ({ expect }) => {
    const document = buildDocument({
      method: 'POST',
      matcher: '/store/auth/login',
      handler: () => Promise.resolve({ status: 200, json: {} }),
      auth: 'public',
      returnsUnauthorized: true,
      operationId: 'storeAuthLogin',
      tags: [Tags.AUTH],
      output: z.object({}),
    })

    expect(document.paths?.['/store/auth/login']?.post?.responses).toHaveProperty('401')
  })
})
