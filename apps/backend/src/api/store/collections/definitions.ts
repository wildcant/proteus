import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as collectionRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/store/collections',
    handler: collectionRoutes.GET,
    input: collectionRoutes.GetInput,
    auth: 'public',
    operationId: 'listStoreProductCollections',
    summary: 'List Collections',
    tags: [Tags.COLLECTIONS],
    output: collectionRoutes.GetOutput,
  },
] satisfies RouteDefinition[]
