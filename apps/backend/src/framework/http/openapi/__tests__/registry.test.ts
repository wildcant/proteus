import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import { test } from '@tests/setup/test-extend.js'
import { z } from 'zod'
import { registerOpenApiRoute } from '../register-route.js'
import { BEARER_SCHEME_NAME, createRegistry, documentInfo, generateDocument } from '../registry.js'

const route = (matcher: string, operationId: string, tags: RouteDefinition['tags']): RouteDefinition => ({
  method: 'GET',
  matcher,
  handler: () => Promise.resolve({ status: 200, json: {} }),
  operationId,
  tags,
  output: z.object({}),
})

const buildDocument = (definitions: RouteDefinition[]) => {
  const registry = createRegistry()
  for (const definition of definitions) {
    registerOpenApiRoute(registry, definition.matcher, definition)
  }
  return generateDocument(registry, { title: 'Test API', description: 'Test API description' })
}

test.describe('generateDocument', () => {
  test('publishes the bearer security scheme', ({ expect }) => {
    const document = buildDocument([route('/admin/users', 'listUsers', [Tags.USERS])])

    expect(document.components?.securitySchemes?.[BEARER_SCHEME_NAME]).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    })
  })

  test('defaults the document to the bearer scheme', ({ expect }) => {
    const document = buildDocument([route('/admin/users', 'listUsers', [Tags.USERS])])

    expect(document.security).toEqual([{ [BEARER_SCHEME_NAME]: [] }])
  })

  test('carries the title and description it is given', ({ expect }) => {
    const document = buildDocument([route('/admin/users', 'listUsers', [Tags.USERS])])

    expect(document.info.title).toBe('Test API')
    expect(document.info.description).toBe('Test API description')
  })

  test('both shipped documents describe themselves', ({ expect }) => {
    for (const info of Object.values(documentInfo)) {
      expect(info.description.length).toBeGreaterThan(0)
    }
  })

  test('derives the tag list from the registered routes, deduplicated and sorted', ({ expect }) => {
    const document = buildDocument([
      route('/admin/users', 'listUsers', [Tags.USERS]),
      route('/admin/users/:id', 'getUser', [Tags.USERS]),
      route('/admin/products', 'listProducts', [Tags.PRODUCTS]),
      route('/admin/invites', 'listInvites', [Tags.INVITES]),
    ])

    expect(document.tags).toEqual([{ name: Tags.INVITES }, { name: Tags.PRODUCTS }, { name: Tags.USERS }])
  })

  test('covers every tag its own operations use', ({ expect }) => {
    const document = buildDocument([
      route('/admin/products', 'listProducts', [Tags.PRODUCTS, Tags.PRODUCT_VARIANTS]),
      route('/admin/orders', 'listOrders', [Tags.ORDERS]),
    ])

    const declared = new Set(document.tags?.map((tag) => tag.name))
    const used = new Set(
      Object.values(document.paths ?? {}).flatMap((item) => Object.values(item).flatMap((op) => op.tags ?? [])),
    )

    expect([...used].every((tag) => declared.has(tag))).toBe(true)
    expect(declared.size).toBe(used.size)
  })
})
