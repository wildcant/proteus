import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import { test } from '@tests/setup/test-extend.js'
import { z } from 'zod'
import { registerOpenApiRoute } from '../register-route.js'
import { createRegistry, generateDocument } from '../registry.js'

const buildDocument = (definition: RouteDefinition) => {
  const registry = createRegistry()
  registerOpenApiRoute(registry, definition.matcher, definition)
  return generateDocument(registry, 'Test API')
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
})
