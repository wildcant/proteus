import { Connection } from '@temporalio/client'
import type { Duration } from '@temporalio/common'
import { AppError, ErrorTypes } from '../../core/errors/app-error.js'

/**
 * The one thing about the API process that nothing downstream can survive, asked at boot.
 *
 * Every route that starts a checkout dispatches a workflow, and `start()` reconciles every cron
 * job's Temporal Schedule. Both go through the frontend service at `TEMPORAL_ADDRESS`, so an API
 * that comes up without it is an API whose every workflow dispatch fails somewhere inside a
 * shopper's checkout — and, since ILLO-115 removed the `NODE_ENV=test` guard around
 * `scheduler.start(jobs)`, one that also dies on its own reconciliation.
 *
 * ## Before `listen()`, not after
 *
 * Reconciliation runs *after* `expressApp.listen()` (`src/start.ts`), and a job that cannot be
 * reconciled throws an aggregate `AppError`. So the failure this check removes is not "the API logs
 * something": it is a process that bound the port, answered `/health` with 200, and then died on an
 * unhandled top-level rejection. Under Playwright that is a backend which passes the `webServer`
 * readiness check and *then* disappears, which is about the least diagnosable shape the failure has.
 * Asking before the port is bound turns it into a non-zero exit with a message naming the address.
 *
 * That reconciliation runs after `listen()` is left as it is — this check does not reorder it, it
 * gets in front of it.
 *
 * ## Unconditional
 *
 * No `NODE_ENV` exemption and no env flag. The e2e suites already need a running Temporal for the
 * workflow Worker, so an API that refuses to boot without one takes away nothing that worked
 * before; and a conditional boot dependency is the shape where the check is absent exactly on the
 * deployment that needed it.
 *
 * ## Reachability only
 *
 * Whether a Worker is *polling* is a different question with a different answer. A Worker
 * restarting must not take the API down with it, and the API can legitimately enqueue work with
 * nothing polling yet — that is what the task queue is for. `scripts/temporal/worker-ready.ts` is
 * where the poller question is asked, of the Worker, by Docker.
 *
 * ## Not in the workflow engine factory
 *
 * The engine connects lazily on first use, on purpose: building a container must not require a
 * reachable Temporal, or `db:seed:dev` and every test that only touches the database would. That
 * property survives this change — only `start()` gains the dependency, and it gains it here rather
 * than by making the factory eager.
 */

/**
 * Generous, and the SDK's own default written down rather than inherited.
 *
 * The gRPC retry interceptor retries `UNAVAILABLE` until this deadline, so the number is also the
 * tolerance for a server that is still coming up: a Temporal started moments before the API is
 * reported as reachable rather than as down, which is what `docker compose up` followed by
 * `pnpm dev` looks like.
 */
const CONNECT_TIMEOUT: Duration = '10 seconds'

/**
 * Narrowed to the one question this asks, so the check can be exercised without a server and so it
 * carries no opinion about how the connection is made. It takes the address rather than closing
 * over one, which is what makes "the address the failure names" and "the address that was tried"
 * the same value by construction.
 */
export type FrontendProbe = (address: string) => Promise<void>

/**
 * Throws when the Temporal frontend cannot be reached, and returns quietly otherwise.
 *
 * Every failure is fatal here, which is the opposite of the events Worker's preflight in
 * `framework/event-bus/temporal/`: that one isolates a single misconfiguration and leaves transport
 * errors to the poll that follows, because there *is* a poll that follows. Here there is not — the
 * next thing to touch Temporal is a shopper's checkout.
 */
export async function assertTemporalFrontendReachable(deps: { address: string; probe: FrontendProbe }): Promise<void> {
  try {
    await deps.probe(deps.address)
  } catch (error) {
    throw new AppError({
      type: ErrorTypes.SERVICE_UNAVAILABLE,
      message:
        `[api] Temporal is unreachable at ${deps.address}, so the API is refusing to start. ` +
        'Every checkout dispatches a workflow through that address and every boot reconciles the ' +
        'cron Schedules through it, so starting anyway would bind the port, answer /health with ' +
        "200, and then fail inside a shopper's checkout. Start the server " +
        '(`docker compose -f apps/backend/docker-compose.yml up -d --wait temporal`) or point ' +
        `TEMPORAL_ADDRESS at a reachable frontend, then start the API again. The connection ` +
        `attempt said: "${describeConnectFailure(error)}".`,
    })
  }
}

/**
 * The real probe: open a connection, then close it.
 *
 * `Connection.connect` verifies connectivity by calling `getSystemInfo` — that is what separates it
 * from `Connection.lazy`, and it is why no second RPC is made here. A resolved connect is an
 * answered request from the frontend, not an open socket.
 *
 * No payload converter, unlike `createTemporalClient`: this exchanges no payloads, so requiring the
 * converter's `require()` hook to be installed before the API may decide whether Temporal is up
 * would be a second way to fail for a reason that has nothing to do with the question. Closed
 * immediately, because the subsystems that need a connection build their own — see `README.md`.
 */
export const probeTemporalFrontend: FrontendProbe = async (address) => {
  const connection = await Connection.connect({ address, connectTimeout: CONNECT_TIMEOUT })
  await connection.close()
}

/**
 * What the attempt actually said, quoted rather than paraphrased.
 *
 * Only the message, and deliberately not the gRPC status unwrapping the events Worker's preflight
 * does: that one calls `workflowService` directly, so a real status with a `details` string reaches
 * it. `Connection.connect` does not — measured against this stack, a closed port and
 * a hostname that does not resolve both arrive as a flat `Error: Failed to connect before the
 * deadline`, with no `code`, no `details` and no `cause`. Reading fields that are never populated
 * would be machinery implying a precision the SDK does not give us. The address in the message is
 * the actionable half, which is why it is named there rather than left to the quote.
 */
function describeConnectFailure(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
