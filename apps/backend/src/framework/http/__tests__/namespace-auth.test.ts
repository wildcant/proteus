import { test } from '@tests/setup/test-extend.js'
import { z } from 'zod'
import { applyNamespaceAuth } from '../namespace-auth.js'
import type { MiddlewareFunction, RouteDefinition } from '../types.js'
import { Tags } from '../types.js'

const noopHandler = () => Promise.resolve({ status: 200, json: {} })
const noopSchema = z.object({})

function makeDefinition(overrides: Partial<RouteDefinition> & { matcher: string }): RouteDefinition {
  return {
    method: 'GET',
    handler: noopHandler,
    operationId: 'test',
    tags: [Tags.USERS],
    output: noopSchema,
    ...overrides,
  } as RouteDefinition
}

test.describe('applyNamespaceAuth', () => {
  test('admin route with default auth prepends authenticate("user")', ({ expect }) => {
    const definition = makeDefinition({ matcher: '/admin/users' })

    applyNamespaceAuth(definition)

    expect(definition.middlewares).toHaveLength(1)
  })

  test('store route with default auth prepends authenticate("customer")', ({ expect }) => {
    const definition = makeDefinition({ matcher: '/store/products' })

    applyNamespaceAuth(definition)

    expect(definition.middlewares).toHaveLength(1)
  })

  test('auth: "public" does not inject auth middleware', ({ expect }) => {
    const definition = makeDefinition({ matcher: '/admin/products', auth: 'public' })

    applyNamespaceAuth(definition)

    expect(definition.middlewares).toBeUndefined()
  })

  test('auth: "optional" prepends authenticate with allowUnauthenticated', ({ expect }) => {
    const definition = makeDefinition({ matcher: '/store/products', auth: 'optional' })

    applyNamespaceAuth(definition)

    expect(definition.middlewares).toHaveLength(1)
  })

  test('auth: "unregistered" prepends authenticate with allowUnregistered', ({ expect }) => {
    const definition = makeDefinition({ matcher: '/admin/users', auth: 'unregistered' })

    applyNamespaceAuth(definition)

    expect(definition.middlewares).toHaveLength(1)
  })

  test('auth: "required" with custom middlewares prepends auth before custom', ({ expect }) => {
    const customMiddleware: MiddlewareFunction = (req) => req
    const definition = makeDefinition({
      matcher: '/admin/users',
      auth: 'required',
      middlewares: [customMiddleware],
    })

    applyNamespaceAuth(definition)

    expect(definition.middlewares).toHaveLength(2)
    // Auth middleware should be first
    expect(definition.middlewares?.[1]).toBe(customMiddleware)
  })

  test('/auth/ route gets no namespace auth regardless of auth value', ({ expect }) => {
    const definition = makeDefinition({ matcher: '/auth/token/refresh' })

    applyNamespaceAuth(definition)

    expect(definition.middlewares).toBeUndefined()
  })

  test('/hooks/ route gets no namespace auth', ({ expect }) => {
    const definition = makeDefinition({
      matcher: '/hooks/payment/:provider',
      method: 'POST',
    })

    applyNamespaceAuth(definition)

    expect(definition.middlewares).toBeUndefined()
  })

  test('default auth for admin routes without explicit auth field is "required"', ({ expect }) => {
    const definitionWithRequired = makeDefinition({ matcher: '/admin/users', auth: 'required' })
    const definitionWithDefault = makeDefinition({ matcher: '/admin/users' })

    applyNamespaceAuth(definitionWithRequired)
    applyNamespaceAuth(definitionWithDefault)

    // Both should have the same number of middlewares
    expect(definitionWithRequired.middlewares).toHaveLength(1)
    expect(definitionWithDefault.middlewares).toHaveLength(1)
  })
})
