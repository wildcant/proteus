import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as refundReasonByIdRoutes from './[id]/route.js'
import * as refundReasonRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/refund-reasons',
    handler: refundReasonRoutes.GET,
    permissions: ['payment.read'],
    operationId: 'listRefundReasons',
    summary: 'List refund reasons',
    tags: [Tags.REFUND_REASONS],
    output: refundReasonRoutes.GetOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/refund-reasons',
    handler: refundReasonRoutes.POST,
    input: refundReasonRoutes.PostInput,
    permissions: ['payment.refund'],
    operationId: 'createRefundReason',
    summary: 'Create a refund reason',
    tags: [Tags.REFUND_REASONS],
    output: refundReasonRoutes.PostOutput,
  },
  {
    method: 'DELETE',
    matcher: '/admin/refund-reasons/:id',
    handler: refundReasonByIdRoutes.DELETE,
    input: refundReasonByIdRoutes.DeleteInput,
    permissions: ['payment.refund'],
    operationId: 'deleteRefundReason',
    summary: 'Delete a refund reason',
    tags: [Tags.REFUND_REASONS],
    output: refundReasonByIdRoutes.DeleteOutput,
  },
] satisfies RouteDefinition[]
