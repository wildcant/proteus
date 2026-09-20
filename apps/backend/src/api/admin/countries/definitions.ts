import type { RouteDefinition } from '@framework/http/types.js'
import { searchable, Tags } from '@framework/http/types.js'
import type { CountryDTO } from '../../../core/types/region/common.js'
import * as countryRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/countries',
    handler: countryRoutes.GET,
    input: countryRoutes.GetInput,
    // The alpha-2 code as well as the name: a merchant looking for Colombia is as likely to type
    // `co` as `Colom`, and the code is what the Code column shows them.
    searchableColumns: searchable<CountryDTO>('displayName', 'id'),
    operationId: 'listCountries',
    summary: 'List countries',
    tags: [Tags.COUNTRIES],
    output: countryRoutes.GetOutput,
  },
] satisfies RouteDefinition[]
