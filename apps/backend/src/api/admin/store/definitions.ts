import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as storeCurrencyDefaultRoutes from './currencies/[code]/default/route.js'
import * as storeCurrencyRoutes from './currencies/[code]/route.js'
import * as storeCurrenciesRoutes from './currencies/route.js'
import * as storeRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/store',
    handler: storeRoutes.GET,
    permissions: ['store.read'],
    operationId: 'getStore',
    summary: 'Retrieve the store and its currencies',
    tags: [Tags.STORE],
    throws: storeRoutes.GetThrows,
    output: storeRoutes.GetOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/store',
    handler: storeRoutes.POST,
    input: storeRoutes.PostInput,
    permissions: ['store.update'],
    operationId: 'updateStore',
    summary: "Update the store's details",
    tags: [Tags.STORE],
    throws: storeRoutes.PostThrows,
    output: storeRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/store/currencies',
    handler: storeCurrenciesRoutes.POST,
    input: storeCurrenciesRoutes.PostInput,
    permissions: ['store.update'],
    operationId: 'addStoreCurrencies',
    summary: 'Add currencies to the store',
    tags: [Tags.STORE],
    throws: storeCurrenciesRoutes.PostThrows,
    output: storeCurrenciesRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/store/currencies/:code/default',
    handler: storeCurrencyDefaultRoutes.POST,
    input: storeCurrencyDefaultRoutes.PostInput,
    permissions: ['store.update'],
    operationId: 'setDefaultStoreCurrency',
    summary: "Nominate the store's default currency",
    tags: [Tags.STORE],
    throws: storeCurrencyDefaultRoutes.PostThrows,
    output: storeCurrencyDefaultRoutes.PostOutput,
  },
  {
    method: 'DELETE',
    matcher: '/admin/store/currencies/:code',
    handler: storeCurrencyRoutes.DELETE,
    input: storeCurrencyRoutes.DeleteInput,
    permissions: ['store.update'],
    operationId: 'removeStoreCurrency',
    summary: 'Remove a currency from the store',
    tags: [Tags.STORE],
    throws: storeCurrencyRoutes.DeleteThrows,
    output: storeCurrencyRoutes.DeleteOutput,
  },
] satisfies RouteDefinition[]
