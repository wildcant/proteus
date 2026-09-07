import type { RouteDefinition } from '@framework/http/types.js'
import { searchable, Tags } from '@framework/http/types.js'
import type { RegionDTO } from '../../../core/types/region/common.js'
import * as regionCountryRoutes from './[id]/countries/[code]/route.js'
import * as regionCountriesRoutes from './[id]/countries/route.js'
import * as regionByIdRoutes from './[id]/route.js'
import * as regionRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/regions',
    handler: regionRoutes.GET,
    input: regionRoutes.GetInput,
    searchableColumns: searchable<RegionDTO>('name'),
    operationId: 'listRegions',
    summary: 'List regions',
    tags: [Tags.REGIONS],
    output: regionRoutes.GetOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/regions',
    handler: regionRoutes.POST,
    input: regionRoutes.PostInput,
    operationId: 'createRegion',
    summary: 'Create a region',
    tags: [Tags.REGIONS],
    throws: regionRoutes.PostThrows,
    output: regionRoutes.PostOutput,
  },
  {
    method: 'GET',
    matcher: '/admin/regions/:id',
    handler: regionByIdRoutes.GET,
    input: regionByIdRoutes.GetInput,
    operationId: 'getRegion',
    summary: 'Retrieve a region',
    tags: [Tags.REGIONS],
    output: regionByIdRoutes.GetOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/regions/:id',
    handler: regionByIdRoutes.POST,
    input: regionByIdRoutes.PostInput,
    operationId: 'updateRegion',
    summary: 'Update a region',
    tags: [Tags.REGIONS],
    throws: regionByIdRoutes.PostThrows,
    output: regionByIdRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/regions/:id/countries',
    handler: regionCountriesRoutes.POST,
    input: regionCountriesRoutes.PostInput,
    operationId: 'assignRegionCountries',
    summary: 'Assign countries to a region',
    tags: [Tags.REGIONS],
    throws: regionCountriesRoutes.PostThrows,
    output: regionCountriesRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/regions/:id/countries/:code',
    handler: regionCountryRoutes.POST,
    input: regionCountryRoutes.PostInput,
    operationId: 'updateRegionCountryLocale',
    summary: "Update a country's locale",
    tags: [Tags.REGIONS],
    throws: regionCountryRoutes.PostThrows,
    output: regionCountryRoutes.PostOutput,
  },
  {
    method: 'DELETE',
    matcher: '/admin/regions/:id/countries/:code',
    handler: regionCountryRoutes.DELETE,
    input: regionCountryRoutes.DeleteInput,
    operationId: 'removeRegionCountry',
    summary: 'Remove a country from a region',
    tags: [Tags.REGIONS],
    throws: regionCountryRoutes.DeleteThrows,
    output: regionCountryRoutes.DeleteOutput,
  },
] satisfies RouteDefinition[]
