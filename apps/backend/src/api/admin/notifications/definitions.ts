import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as notificationByIdRoutes from './[id]/route.js'
import * as notificationRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/notifications',
    handler: notificationRoutes.GET,
    input: notificationRoutes.GetInput,
    permissions: ['notification.read'],
    operationId: 'listNotifications',
    summary: 'List notifications',
    tags: [Tags.NOTIFICATIONS],
    output: notificationRoutes.GetOutput,
  },
  {
    method: 'GET',
    matcher: '/admin/notifications/:id',
    handler: notificationByIdRoutes.GET,
    input: notificationByIdRoutes.GetInput,
    permissions: ['notification.read'],
    operationId: 'getNotification',
    summary: 'Retrieve a notification',
    tags: [Tags.NOTIFICATIONS],
    output: notificationByIdRoutes.GetOutput,
  },
] satisfies RouteDefinition[]
