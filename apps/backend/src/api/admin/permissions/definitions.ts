import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as permissionByIdRoutes from './[id]/route.js'
import * as permissionRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/permissions',
    handler: permissionRoutes.GET,
    permissions: ['access-control.role.read'],
    operationId: 'listPermissions',
    summary: 'List registered permissions',
    tags: [Tags.PERMISSIONS],
    output: permissionRoutes.GetOutput,
  },
  {
    method: 'GET',
    matcher: '/admin/permissions/:id',
    handler: permissionByIdRoutes.GET,
    input: permissionByIdRoutes.GetInput,
    permissions: ['access-control.role.read'],
    operationId: 'getPermission',
    summary: 'Retrieve a permission',
    tags: [Tags.PERMISSIONS],
    output: permissionByIdRoutes.GetOutput,
  },
] satisfies RouteDefinition[]
