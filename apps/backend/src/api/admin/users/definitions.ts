import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as userByIdRoutes from './[id]/route.js'
import * as meRoutes from './me/route.js'
import * as userRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/users/me',
    handler: meRoutes.GET,
    throws: meRoutes.GetThrows,
    operationId: 'getMe',
    summary: 'Retrieve the authenticated user',
    tags: [Tags.USERS],
    output: meRoutes.GetOutput,
  },
  {
    method: 'GET',
    matcher: '/admin/users',
    handler: userRoutes.GET,
    input: userRoutes.GetInput,
    permissions: ['user.read'],
    operationId: 'listUsers',
    summary: 'List users',
    tags: [Tags.USERS],
    output: userRoutes.GetOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/users',
    handler: userRoutes.POST,
    input: userRoutes.PostInput,
    permissions: ['user.create'],
    operationId: 'createUser',
    summary: 'Create a user',
    tags: [Tags.USERS],
    output: userRoutes.PostOutput,
  },
  {
    method: 'GET',
    matcher: '/admin/users/:id',
    handler: userByIdRoutes.GET,
    input: userByIdRoutes.GetInput,
    permissions: ['user.read'],
    operationId: 'getUser',
    summary: 'Retrieve a user',
    tags: [Tags.USERS],
    output: userByIdRoutes.GetOutput,
  },
  {
    method: 'PATCH',
    matcher: '/admin/users/:id',
    handler: userByIdRoutes.PATCH,
    input: userByIdRoutes.PatchInput,
    permissions: ['user.update'],
    operationId: 'updateUser',
    summary: 'Update a user',
    tags: [Tags.USERS],
    output: userByIdRoutes.PatchOutput,
  },
  {
    method: 'DELETE',
    matcher: '/admin/users/:id',
    handler: userByIdRoutes.DELETE,
    input: userByIdRoutes.DeleteInput,
    permissions: ['user.delete'],
    operationId: 'deleteUser',
    summary: 'Delete a user',
    tags: [Tags.USERS],
    output: userByIdRoutes.DeleteOutput,
  },
] satisfies RouteDefinition[]
