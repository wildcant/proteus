import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as reservationRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/reservations',
    handler: reservationRoutes.GET,
    input: reservationRoutes.GetInput,
    permissions: ['inventory.read'],
    operationId: 'listReservations',
    summary: 'List reservations',
    tags: [Tags.RESERVATIONS],
    output: reservationRoutes.GetOutput,
  },
] satisfies RouteDefinition[]
