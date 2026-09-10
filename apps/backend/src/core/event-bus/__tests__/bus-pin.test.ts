import type { EventBus } from '@core/event-bus/types.js'
import type { Logger } from '@core/types/logger.js'
import { ContainerRegistrationKeys } from '@core/utils/index.js'
import { pinnedTestEventBusAdapter } from '@tests/setup/event-bus-adapter.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { noopLogger } from '../../../framework/logger/noop-logger.js'

/**
 * Proof that a run published through the adapter it claims to pin.
 *
 * This is `engine-pin.test.ts` for the bus, and it exists for the same failure shape: an adapter
 * swap that nothing notices. Under vitest `RUNTIME` is `node`, so the *derived* adapter is a
 * transport — a suite that quietly stopped pinning would hand every event to something that
 * accepts it and dispatches elsewhere, and "accepted" is all `emit` ever promises. Assertions
 * about what a subscriber did would still fail, but assertions about publishing would not, and the
 * arc would be proven by nothing.
 *
 * It asserts *where the subscriber ran*, not what the config said — the same distinction the engine
 * pin makes. Having run in this process by the time `emit` resolved is a property only an in-process
 * adapter has: a queue producer returns once the message is accepted, with the handler still to be
 * delivered somewhere else entirely. That `emit` also waits for it is `inline-adapter.test.ts`'s
 * assertion, not this one's — this file is about which adapter, not about how it behaves.
 *
 * It asserts the adapter the run pins rather than a fixed one, so it keeps meaning something when
 * there is a second value to pin. What it does not cover: a test that passes its own
 * `config.projectConfig.eventBus.adapter` still gets that adapter, because the harness supplies a
 * default rather than an override. Nothing does that today, and a test naming an adapter is a
 * visible line in a diff rather than a silent drift.
 */

const logged: string[] = []
const recordingLogger: Logger = {
  ...noopLogger,
  info(message) {
    logged.push(message)
  },
}
const testWithLog = test.extend<Pick<Fixtures, 'logger'>>({
  async logger({ task: _ }, use) {
    await use(recordingLogger)
  },
})

test.describe('the pinned event bus adapter', () => {
  testWithLog('is the one that actually runs the subscribers', async ({ createTestContainer, expect }) => {
    logged.length = 0
    const container = await createTestContainer()
    const bus = container.resolve<EventBus>(ContainerRegistrationKeys.EVENT_BUS)

    await bus.emit('bus.probe', { id: 'probe_1' })

    const ranInThisProcess = logged.includes('[bus-probe] bus.probe:probe_1:bus-probe')

    if (pinnedTestEventBusAdapter() === 'inline') {
      expect(
        ranInThisProcess,
        'the subscriber had not run when emit resolved, so this run is not on the adapter it pins',
      ).toBe(true)
    } else {
      expect(
        ranInThisProcess,
        'the subscriber ran inside emit, but this run pins a transport that dispatches elsewhere',
      ).toBe(false)
    }
  })
})
