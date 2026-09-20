import type { PermissionKey } from '@core/types/access-control/common.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { WorkflowContext } from '@core/workflows/types.js'
import { buildOperatorAlerts, type OperatorAlert } from '../utils/operator-alert.js'

export type NotifyOnFailureInput = {
  /** Every feature an operator must hold to be told. See [buildOperatorAlerts]'s caller list. */
  features: PermissionKey[]
  alert: OperatorAlert
}

/**
 * Tells the operators a workflow unwound, and only then.
 *
 * **Who to tell is resolved in the compensation, not in the action.** The action is a no-op that
 * hands its input straight back, so a workflow that succeeds — which is nearly all of them — pays
 * nothing for an alert it never sends. The alternative, resolving up front, would put two reads on
 * every successful run to prepare a row that gets thrown away.
 *
 * The lookup cannot move any earlier than the action either way: the caller composes this in the
 * workflow body, which is replayed and may not call a service.
 */
export async function notifyOnFailureStep(ctx: WorkflowContext, input: NotifyOnFailureInput): Promise<void> {
  await ctx.step<NotifyOnFailureInput>(
    'notify-on-failure',
    async () => input,
    async ({ features, alert }, { container }) => {
      const accessControlService = container.resolve(Modules.ACCESS_CONTROL)
      const userService = container.resolve(Modules.USER)
      const notificationService = container.resolve(Modules.NOTIFICATION)

      const operatorIds = await accessControlService.listActorIdsWithFeatures('user', features)
      const operators = await userService.listUsers({ id: operatorIds })

      await notificationService.createNotifications(
        buildOperatorAlerts(
          operators.map((operator) => operator.email),
          alert,
        ),
      )
    },
  )
}
