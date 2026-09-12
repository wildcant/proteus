import type { EventBusAdapterName } from '@core/types/config.js'

/**
 * Which event bus adapter `createTestContainer` pins when a test does not ask for one.
 *
 * A module-level value rather than an environment variable, for the reason
 * `resolveEventBusAdapterName` gives: there is no `EVENT_BUS` env var, and `RUNTIME` is `node` under
 * vitest, so the derived answer is a transport the suite must not need.
 *
 * Unlike the workflow engine there is no second value in play and no parity suite to flip it — the
 * bus does not get one on purpose, because only a handful of tests exercise it and the transports'
 * own behaviour is covered directly against a real server. It is a function rather than a constant
 * so `__tests__/bus-pin.test.ts` asserts the adapter the harness *claims* against the one that
 * actually ran, which is the shape that keeps working when there is a second value to claim.
 */
export function pinnedTestEventBusAdapter(): EventBusAdapterName {
  return 'inline'
}
