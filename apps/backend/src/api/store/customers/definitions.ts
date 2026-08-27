import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as addressByIdRoutes from './me/addresses/[id]/route.js'
import * as addressRoutes from './me/addresses/route.js'
import * as meRoutes from './me/route.js'
import { validateAddressOwnership } from './middlewares.js'

export default [
  {
    method: 'GET',
    matcher: '/store/customers/me',
    handler: meRoutes.GET,
    operationId: 'getStoreCustomerMe',
    summary: 'Get the authenticated customer',
    tags: [Tags.CUSTOMERS],
    output: meRoutes.GetOutput,
  },
  {
    method: 'GET',
    matcher: '/store/customers/me/addresses',
    handler: addressRoutes.GET,
    operationId: 'listStoreCustomerAddresses',
    summary: "List the authenticated customer's addresses",
    tags: [Tags.CUSTOMERS],
    output: addressRoutes.GetOutput,
  },
  {
    method: 'POST',
    matcher: '/store/customers/me/addresses',
    handler: addressRoutes.POST,
    input: addressRoutes.PostInput,
    operationId: 'createStoreCustomerAddress',
    summary: 'Add an address to the address book',
    tags: [Tags.CUSTOMERS],
    output: addressRoutes.PostOutput,
  },
  {
    method: 'PATCH',
    matcher: '/store/customers/me/addresses/:id',
    handler: addressByIdRoutes.PATCH,
    input: addressByIdRoutes.PatchInput,
    middlewares: [validateAddressOwnership()],
    operationId: 'updateStoreCustomerAddress',
    summary: 'Update an address in the address book',
    tags: [Tags.CUSTOMERS],
    output: addressByIdRoutes.PatchOutput,
  },
  {
    method: 'DELETE',
    matcher: '/store/customers/me/addresses/:id',
    handler: addressByIdRoutes.DELETE,
    input: addressByIdRoutes.DeleteInput,
    middlewares: [validateAddressOwnership()],
    operationId: 'deleteStoreCustomerAddress',
    summary: 'Remove an address from the address book',
    tags: [Tags.CUSTOMERS],
    output: addressByIdRoutes.DeleteOutput,
  },
] satisfies RouteDefinition[]
