import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as resendRoutes from './[id]/resend/route.js'
import * as inviteByIdRoutes from './[id]/route.js'
import * as acceptRoutes from './accept/route.js'
import * as inviteRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/invites',
    handler: inviteRoutes.GET,
    input: inviteRoutes.GetInput,
    operationId: 'listInvites',
    summary: 'List invites',
    tags: [Tags.INVITES],
    output: inviteRoutes.GetOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/invites',
    handler: inviteRoutes.POST,
    throws: inviteRoutes.PostThrows,
    input: inviteRoutes.PostInput,
    operationId: 'createInvite',
    summary: 'Create an invite',
    tags: [Tags.INVITES],
    output: inviteRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/invites/accept',
    handler: acceptRoutes.POST,
    throws: acceptRoutes.PostThrows,
    auth: 'public',
    input: acceptRoutes.PostInput,
    operationId: 'acceptInvite',
    summary: 'Accept an invite',
    tags: [Tags.INVITES],
    output: acceptRoutes.PostOutput,
  },
  {
    method: 'GET',
    matcher: '/admin/invites/:id',
    handler: inviteByIdRoutes.GET,
    input: inviteByIdRoutes.GetInput,
    operationId: 'getInvite',
    summary: 'Retrieve an invite',
    tags: [Tags.INVITES],
    output: inviteByIdRoutes.GetOutput,
  },
  {
    method: 'DELETE',
    matcher: '/admin/invites/:id',
    handler: inviteByIdRoutes.DELETE,
    input: inviteByIdRoutes.DeleteInput,
    operationId: 'deleteInvite',
    summary: 'Delete an invite',
    tags: [Tags.INVITES],
    output: inviteByIdRoutes.DeleteOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/invites/:id/resend',
    handler: resendRoutes.POST,
    throws: resendRoutes.PostThrows,
    input: resendRoutes.PostInput,
    operationId: 'resendInvite',
    summary: 'Resend an invite',
    tags: [Tags.INVITES],
    output: resendRoutes.PostOutput,
  },
] satisfies RouteDefinition[]
