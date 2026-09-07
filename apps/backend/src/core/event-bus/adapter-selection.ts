import type { EventBusAdapterName } from '../config/types.js'

/**
 * Which transport carries events when nothing pins one.
 *
 * There is no `EVENT_BUS` env var and there is not meant to be, for the same reason
 * `resolveWorkflowEngineName` has none: the choice is not free per deployment. workerd physically
 * cannot load `@temporalio/core-bridge`, and Cloudflare Queues do not exist outside workerd, so each
 * runtime has exactly one production answer and picking it is not something anyone should be able to
 * get wrong from a `.env` file.
 *
 * A caller that genuinely needs the third one says so through `projectConfig.eventBus.adapter` at a
 * composition root, where the reason is visible next to the choice. The test suite is one such
 * caller: `RUNTIME` is `node` under vitest, so the derived answer would be Temporal and every test
 * touching an emit would need a running server.
 *
 * The two transports this returns do not exist yet — they land in ILLO-87 and ILLO-88, one adapter
 * file each. Until then every composition root pins `inline`, and `bootstrapContainer` refuses to
 * boot rather than quietly substituting something. The rule is here now because it is the rule; what
 * is missing is only the code it names.
 */
export function resolveEventBusAdapterName(input: {
  configured: EventBusAdapterName | undefined
  runtime: 'node' | 'workerd'
}): EventBusAdapterName {
  if (input.configured) return input.configured
  return input.runtime === 'workerd' ? 'cloudflare-queues' : 'temporal'
}
