import { AppError } from '@core/errors/app-error.js'
import { test } from '@tests/setup/test-extend.js'
import { assertTemporalFrontendReachable } from '../preflight.js'

/**
 * The boot check that turns "the API came up and then died during checkout" into a refusal to start.
 *
 * Both paths are stood up through the injected probe, which is why this file needs no Temporal
 * server: the decision under test is what the API does with the probe's answer — refuse loudly, or
 * continue — and not how a gRPC connection is made. The real probe is one `Connection.connect`
 * call, verified by the two `pnpm dev` runs in the issue's verification rather than here.
 */

/**
 * What `Connection.connect` rejects with, observed against this stack: a flat `Error`, with no gRPC
 * status on it and none under `cause`. A closed port and a hostname that does not resolve both
 * produce exactly this, which is why the failure message names the address rather than leaning on
 * the quote to say what went wrong.
 */
const CONNECT_FAILURE = 'Failed to connect before the deadline'

const reachable = async () => {
  // Resolving *is* the answer. A reachable frontend has nothing else to report.
}
const unreachable = (error: unknown) => async () => {
  throw error
}

test.describe('the API boot preflight', () => {
  test('starts normally when the frontend answers', async ({ expect }) => {
    await expect(
      assertTemporalFrontendReachable({ address: 'localhost:7233', probe: reachable }),
    ).resolves.toBeUndefined()
  })

  test('refuses to start when the frontend cannot be reached', async ({ expect }) => {
    // Loud, and an AppError rather than a bare rethrow: the point of the check is a boot failure
    // that names itself, instead of an unhandled rejection out of cron reconciliation after the
    // port is already bound.
    const failure = await assertTemporalFrontendReachable({
      address: 'localhost:7233',
      probe: unreachable(new Error(CONNECT_FAILURE)),
    }).catch((error: unknown) => error)

    expect(AppError.isError(failure)).toBe(true)
    expect((failure as AppError).type).toBe(AppError.Types.SERVICE_UNAVAILABLE)
  })

  test('names Temporal, the address it tried, and what the attempt said', async ({ expect }) => {
    // The address is the one actionable fact: a developer whose stack is up is usually looking at
    // the wrong TEMPORAL_ADDRESS, and nothing else in the failure can tell them that.
    await expect(
      assertTemporalFrontendReachable({
        address: 'temporal.internal:7233',
        probe: unreachable(new Error(CONNECT_FAILURE)),
      }),
    ).rejects.toThrow(/Temporal.*temporal\.internal:7233.*Failed to connect before the deadline/s)
  })

  test('tries the address it was given', async ({ expect }) => {
    // So the address in the message cannot drift from the one that was probed.
    const tried: string[] = []

    await assertTemporalFrontendReachable({
      address: 'temporal.internal:7233',
      probe: async (address) => {
        tried.push(address)
      },
    })

    expect(tried).toEqual(['temporal.internal:7233'])
  })

  test('quotes a rejection that is not an Error', async ({ expect }) => {
    // A rejection is not obliged to be an Error, and the quote is built from whatever the probe
    // threw. Without the coercion the actionable half of the message reads `[object Object]`.
    await expect(
      assertTemporalFrontendReachable({ address: 'localhost:7233', probe: unreachable('ECONNREFUSED') }),
    ).rejects.toThrow(/ECONNREFUSED/)
  })
})
