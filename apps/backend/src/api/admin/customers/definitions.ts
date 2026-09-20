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
    permissions: ['customer.read'],
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
    permissions: ['customer.create'],
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
    permissions: ['customer.read'],
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
    permissions: ['customer.update'],
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
    permissions: ['customer.delete'],
    operationId: 'deleteCustomer',
    summary: 'Delete a customer',
    tags: [Tags.CUSTOMERS],
    output: customerByIdRoutes.DeleteOutput,
  },
] satisfies RouteDefinition[]
