import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as customerByIdRoutes from './[id]/route.js'
import * as customerRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/customers',
    handler: customerRoutes.GET,
    input: customerRoutes.GetInput,
    operationId: 'listCustomers',
    summary: 'List customers',
    tags: [Tags.CUSTOMERS],
    output: customerRoutes.GetOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/customers',
    handler: customerRoutes.POST,
    input: customerRoutes.PostInput,
    operationId: 'createCustomers',
    summary: 'Create customers',
    tags: [Tags.CUSTOMERS],
    output: customerRoutes.PostOutput,
  },
  {
    method: 'GET',
    matcher: '/admin/customers/:id',
    handler: customerByIdRoutes.GET,
    input: customerByIdRoutes.GetInput,
    operationId: 'getCustomer',
    summary: 'Retrieve a customer',
    tags: [Tags.CUSTOMERS],
    output: customerByIdRoutes.GetOutput,
  },
  {
    method: 'PATCH',
    matcher: '/admin/customers/:id',
    handler: customerByIdRoutes.PATCH,
    input: customerByIdRoutes.PatchInput,
    operationId: 'updateCustomer',
    summary: 'Update a customer',
    tags: [Tags.CUSTOMERS],
    output: customerByIdRoutes.PatchOutput,
  },
  {
    method: 'DELETE',
    matcher: '/admin/customers/:id',
    handler: customerByIdRoutes.DELETE,
    input: customerByIdRoutes.DeleteInput,
    operationId: 'deleteCustomer',
    summary: 'Delete a customer',
    tags: [Tags.CUSTOMERS],
    output: customerByIdRoutes.DeleteOutput,
  },
] satisfies RouteDefinition[]
