import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as countryRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/store/countries',
    handler: countryRoutes.GET,
    auth: 'public',
    input: countryRoutes.GetInput,
    operationId: 'listStoreCountries',
    summary: 'List countries, sellable ones by default',
    tags: [Tags.COUNTRIES],
    output: countryRoutes.GetOutput,
  },
] satisfies RouteDefinition[]
