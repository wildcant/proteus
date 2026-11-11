import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as navigationRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/store/navigation',
    handler: navigationRoutes.GET,
    auth: 'public',
    operationId: 'getStoreNavigation',
    summary: "Retrieve the store's menu",
    description:
      'The menu entries in order, each a Category (shown with its children) or a Collection by handle. A handle naming no visible grouping is skipped by the storefront.',
    tags: [Tags.STORE],
    output: navigationRoutes.GetOutput,
  },
] satisfies RouteDefinition[]
