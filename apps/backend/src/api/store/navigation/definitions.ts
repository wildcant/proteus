import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as navigationRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/store/navigation',
    handler: navigationRoutes.GET,
    input: navigationRoutes.GetInput,
    middlewares: navigationRoutes.GetMiddlewares,
    auth: 'public',
    operationId: 'getStoreNavigation',
    summary: "Retrieve the store's menu",
    description:
      'The menu entries in order, each a Category or a Collection by handle. An entry without sections is a Category shown with its children; one with sections opens a panel of them, each link a list by handle and the field values it filters by, read for the market. A handle naming no visible grouping is skipped by the storefront.',
    tags: [Tags.STORE],
    output: navigationRoutes.GetOutput,
  },
] satisfies RouteDefinition[]
