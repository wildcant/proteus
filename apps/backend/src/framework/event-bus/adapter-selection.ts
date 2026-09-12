import type { EventBusAdapterName } from '../../core/types/config.js'

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
 * Both transports exist — `temporal-adapter.ts` and `cloudflare-queues-adapter.ts` — and neither can
 * be built by `bootstrapContainer` itself, so a composition root passes a factory alongside its pin.
 * The node roots take `temporal` by derivation and name nothing; the workerd root names
 * `cloudflare-queues` explicitly even though it derives it, so a deploy's answer reads next to the
 * wiring that supplies the binding. `bootstrapContainer` still refuses to boot when the factory is
 * missing: an adapter it cannot build must never quietly become a different one.
 */
export function resolveEventBusAdapterName(input: {
  configured: EventBusAdapterName | undefined
  runtime: 'node' | 'workerd'
}): EventBusAdapterName {
  if (input.configured) return input.configured
  return input.runtime === 'workerd' ? 'cloudflare-queues' : 'temporal'
}
