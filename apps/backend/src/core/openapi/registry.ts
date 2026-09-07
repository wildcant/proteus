import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi'

/**
 * The single security scheme both documents publish. Admin and store share one `Authorization`
 * bearer header and differ only by the actor claim inside the JWT, so one name covers both.
 */
export const BEARER_SCHEME_NAME = 'bearerAuth'

type Definitions = OpenAPIRegistry['definitions']

export type DocumentInfo = {
  title: string
  description: string
}

/** Both call sites — the Swagger UI in `start.ts` and `scripts/openapi-dump.ts` — read these. */
export const documentInfo = {
  admin: {
    title: 'Admin API',
    description: 'Back-office API for staff: catalog, orders, fulfillment, payments and users.',
  },
  store: {
    title: 'Store API',
    description: 'Storefront API for shoppers: product browsing, carts, checkout and orders.',
  },
} as const satisfies Record<string, DocumentInfo>

export function createRegistry() {
  return new OpenAPIRegistry()
}

/**
 * Every tag the document's own operations use. Derived rather than listed, because the two
 * documents carry different tag sets and a hand-maintained list rots the first time a route
 * gains a tag.
 */
function collectTags(definitions: Definitions) {
  const names = new Set<string>()
  for (const definition of definitions) {
    if (definition.type !== 'route') continue
    for (const tag of definition.route.tags ?? []) names.add(tag)
  }
  return [...names].sort().map((name) => ({ name }))
}

export function generateDocument(registry: OpenAPIRegistry, info: DocumentInfo) {
  const definitions = registry.definitions
  const generator = new OpenApiGeneratorV31([
    ...definitions,
    {
      type: 'component',
      componentType: 'securitySchemes',
      name: BEARER_SCHEME_NAME,
      component: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  ])
  return generator.generateDocument({
    openapi: '3.1.0',
    info: { ...info, version: '0.1.0' },
    servers: [{ url: 'http://localhost:3000' }],
    security: [{ [BEARER_SCHEME_NAME]: [] }],
    tags: collectTags(definitions),
  })
}
