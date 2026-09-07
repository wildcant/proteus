import { test } from '@tests/setup/test-extend.js'
import { assertStandaloneActivitiesEnabled } from '../temporal/preflight.js'

/**
 * The boot check that turns D11's silent-drop mode into a refusal to start.
 *
 * A node deployment whose Temporal server lacks `activity.enableStandalone` refuses every dispatch,
 * and because `emit` never rejects that arrives as every event dropped with one log line each — a
 * shopper's missing order confirmation, and nothing anywhere that looks like a failure. The suite
 * structurally cannot catch it: the CLI dev server the tests boot has the flag on.
 *
 * So the two answers are stood up here as the errors a gRPC client actually produces, and the
 * shapes are not invented — both were observed against real servers while writing this. A
 * self-hosted `temporalio/server` 1.31.2 without the flag answers `12 UNIMPLEMENTED: Standalone
 * activity is disabled`; the CLI dev server answers `5 NOT_FOUND: activity not found for ID`.
 * `temporal-adapter.server.test.ts` pins the passing half against a live server too, which is the
 * half a fake could get wrong on its own.
 */

/** What `@grpc/grpc-js` hands back: a status code and the server's own `details` string. */
function grpcError(code: number, details: string): Error {
  return Object.assign(new Error(`${code}: ${details}`), { code, details })
}

/** What the Temporal client wraps that in — the same status, one level down under `cause`. */
function serviceError(code: number, details: string): Error {
  return new Error('Failed to describe activity', { cause: grpcError(code, details) })
}

const rejectWith = (error: Error) => () => Promise.reject(error)

test.describe('the events worker preflight', () => {
  test('refuses to boot when the server has standalone activities disabled', async ({ expect }) => {
    await expect(
      assertStandaloneActivitiesEnabled({
        namespace: 'default',
        describeActivityExecution: rejectWith(serviceError(12, 'Standalone activity is disabled')),
      }),
      // Loud, and specific enough to act on: the flag, the file that sets it, and what the server
      // said. The alternative is a Worker that boots happily beside a bus that drops everything.
    ).rejects.toThrow(/activity\.enableStandalone/)
  })

  test('names the namespace and quotes the server in the failure', async ({ expect }) => {
    await expect(
      assertStandaloneActivitiesEnabled({
        namespace: 'proteus-prod',
        describeActivityExecution: rejectWith(serviceError(12, 'Standalone activity is disabled')),
      }),
    ).rejects.toThrow(/"proteus-prod".*Standalone activity is disabled/s)
  })

  test('passes when the server answers that the probe activity does not exist', async ({ expect }) => {
    // NOT_FOUND is the success case: a server with the API says the id is unknown, which is true —
    // nothing is ever started under it.
    await expect(
      assertStandaloneActivitiesEnabled({
        namespace: 'default',
        describeActivityExecution: rejectWith(serviceError(5, 'activity not found for ID: probe')),
      }),
    ).resolves.toBeUndefined()
  })

  test('leaves every other failure to the Worker that is about to connect for real', async ({ expect }) => {
    // Unreachable, unauthorized, a namespace that does not exist: all better reported by the poll
    // that follows than by a preflight guessing at them, and none of them is a disabled flag.
    await expect(
      assertStandaloneActivitiesEnabled({
        namespace: 'default',
        describeActivityExecution: rejectWith(serviceError(14, 'connection refused')),
      }),
    ).resolves.toBeUndefined()
  })

  test('reads the status even when the client does not wrap it', async ({ expect }) => {
    // The raw `workflowService` call rejects with the gRPC error itself rather than a ServiceError
    // around it, so the code is at the top level. Both shapes reach the same verdict.
    await expect(
      assertStandaloneActivitiesEnabled({
        namespace: 'default',
        describeActivityExecution: rejectWith(grpcError(12, 'Standalone activity is disabled')),
      }),
    ).rejects.toThrow(/activity\.enableStandalone/)
  })
})
