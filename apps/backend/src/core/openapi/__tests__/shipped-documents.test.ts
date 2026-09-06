import type { RouteDefinition } from '@framework/http/types.js'
import { test } from '@tests/setup/test-extend.js'
import { adminDefinitions, storeDefinitions } from '../../../routes.js'
import { registerOpenApiRoute } from '../register-route.js'
import { BEARER_SCHEME_NAME, createRegistry, type DocumentInfo, documentInfo, generateDocument } from '../registry.js'

/**
 * The two documents that actually ship, built from the real route definitions. Every other case in
 * this directory builds a synthetic `RouteDefinition`, so none of them can catch a route that is
 * classified wrongly — which is how three public `/auth/*` operations shipped claiming to need a
 * bearer token.
 */
const buildDocument = (definitions: RouteDefinition[], info: DocumentInfo) => {
  const registry = createRegistry()
  for (const definition of definitions) {
    registerOpenApiRoute(registry, definition.matcher, definition)
  }
  return generateDocument(registry, info)
}

const httpMethods = ['get', 'post', 'put', 'patch', 'delete'] as const

type Operation = { operationId?: string; security?: unknown[]; tags?: string[]; responses?: object }

const operationsOf = (document: ReturnType<typeof buildDocument>): Operation[] =>
  Object.values(document.paths ?? {}).flatMap((item) =>
    httpMethods.flatMap((method) => (item[method] ? [item[method] as Operation] : [])),
  )

const operationIdsWhere = (document: ReturnType<typeof buildDocument>, predicate: (op: Operation) => boolean) =>
  operationsOf(document)
    .filter(predicate)
    .map((operation) => operation.operationId)
    .sort()

const documents = {
  admin: buildDocument(adminDefinitions, documentInfo.admin),
  store: buildDocument(storeDefinitions, documentInfo.store),
}

/**
 * The operations a caller reaches without a token, pinned per document. A route that gains or loses
 * `auth: 'public'` is a change to who can reach it, so it should fail here and be re-read rather
 * than ride along in a regenerated spec.
 */
const unauthenticatedOperations = {
  admin: ['acceptInvite', 'authAuthenticate', 'authRegister', 'authResetPassword'],
  store: ['authResetPassword', 'getStoreProduct', 'listStoreProducts', 'storeAuthLogin', 'storeAuthSignup'],
}

/**
 * The operations that declare no `401` because they cannot send one. ILLO-77 forbids declaring a
 * response an operation never returns, so this list is the documented exception set — not a gap.
 * `authAuthenticate`, `storeAuthLogin` and `storeAuthSignup` are public but do reject credentials
 * in the handler, so they are deliberately absent.
 */
const operationsWithoutUnauthorized = {
  admin: ['acceptInvite', 'authRegister', 'authResetPassword'],
  store: ['authResetPassword', 'getStoreProduct', 'listStoreProducts'],
}

test.describe('shipped OpenAPI documents', () => {
  for (const [name, document] of Object.entries(documents)) {
    test(`${name}: every operation states its security and carries at least one tag`, ({ expect }) => {
      const operations = operationsOf(document)

      expect(operations.length).toBeGreaterThan(0)
      for (const operation of operations) {
        expect(operation.security, `${operation.operationId} has no security`).toBeDefined()
        expect(operation.tags?.length, `${operation.operationId} has no tags`).toBeGreaterThan(0)
      }
    })

    test(`${name}: only the expected operations are reachable without a token`, ({ expect }) => {
      const unauthenticated = operationIdsWhere(document, (operation) => operation.security?.length === 0)

      expect(unauthenticated).toEqual(unauthenticatedOperations[name as keyof typeof unauthenticatedOperations])
    })

    test(`${name}: every authenticated operation requires the bearer scheme`, ({ expect }) => {
      const authenticated = operationsOf(document).filter((operation) => operation.security?.length !== 0)

      for (const operation of authenticated) {
        expect(operation.security, `${operation.operationId} does not require the bearer scheme`).toEqual([
          { [BEARER_SCHEME_NAME]: [] },
        ])
      }
    })

    test(`${name}: only the documented exceptions omit a 401`, ({ expect }) => {
      const without = operationIdsWhere(document, (operation) => !Object.hasOwn(operation.responses ?? {}, '401'))

      expect(without).toEqual(operationsWithoutUnauthorized[name as keyof typeof operationsWithoutUnauthorized])
    })

    test(`${name}: the root tag list matches the tags the operations use`, ({ expect }) => {
      const declared = (document.tags ?? []).map((tag) => tag.name).sort()
      const used = [...new Set(operationsOf(document).flatMap((operation) => operation.tags ?? []))].sort()

      expect(declared).toEqual(used)
    })
  }
})
