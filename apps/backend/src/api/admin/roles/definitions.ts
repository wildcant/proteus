import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as roleByIdRoutes from './[id]/route.js'
import * as roleRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/roles',
    handler: roleRoutes.GET,
    permissions: ['access-control.role.read'],
    operationId: 'listRoles',
    summary: 'List roles',
    tags: [Tags.ROLES],
    output: roleRoutes.GetOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/roles',
    handler: roleRoutes.POST,
    input: roleRoutes.PostInput,
    permissions: ['access-control.role.manage'],
    operationId: 'createRole',
    summary: 'Create a role',
    tags: [Tags.ROLES],
    output: roleRoutes.PostOutput,
  },
  {
    method: 'GET',
    matcher: '/admin/roles/:id',
    handler: roleByIdRoutes.GET,
    input: roleByIdRoutes.GetInput,
    permissions: ['access-control.role.read'],
    operationId: 'getRole',
    summary: 'Retrieve a role with its user count',
    tags: [Tags.ROLES],
    throws: roleByIdRoutes.GetThrows,
    output: roleByIdRoutes.GetOutput,
  },
  {
    method: 'PATCH',
    matcher: '/admin/roles/:id',
    handler: roleByIdRoutes.PATCH,
    input: roleByIdRoutes.PatchInput,
    permissions: ['access-control.role.manage'],
    operationId: 'updateRole',
    summary: 'Update a role',
    tags: [Tags.ROLES],
    throws: roleByIdRoutes.PatchThrows,
    output: roleByIdRoutes.PatchOutput,
  },
  {
    method: 'DELETE',
    matcher: '/admin/roles/:id',
    handler: roleByIdRoutes.DELETE,
    input: roleByIdRoutes.DeleteInput,
    permissions: ['access-control.role.manage'],
    operationId: 'deleteRole',
    summary: 'Delete a role',
    tags: [Tags.ROLES],
    throws: roleByIdRoutes.DeleteThrows,
    output: roleByIdRoutes.DeleteOutput,
  },
] satisfies RouteDefinition[]
