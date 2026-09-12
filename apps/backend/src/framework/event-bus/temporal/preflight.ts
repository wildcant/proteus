import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'

/**
 * The one thing about a node deployment that this bus cannot survive, asked at boot.
 *
 * Standalone activities are gated behind Temporal's `activity.enableStandalone` dynamic config. A
 * server without it answers every start with `UNIMPLEMENTED: Standalone activity is disabled`, and
 * because `emit` never rejects that arrives as **every event silently dropped, one log line each**.
 * Since ILLO-89 a dropped event is a shopper's missing order confirmation, so "silent" stopped
 * being an acceptable shape for it.
 *
 * ## Boot-time, not deploy-time
 *
 * Deploy-time would be a second command to remember and would say nothing about the config drifting
 * afterwards — dynamic config is reloaded from a file while the server runs, so a stack that was
 * correct at deploy can stop being correct without any deploy at all. Boot-time in the events
 * Worker is where the answer is both cheap and load-bearing: that process exists only to serve this
 * bus, it already connects to Temporal before it polls, and a deployment whose flag is off has no
 * working event bus of any kind. Refusing to start there is a crash-looping service with a message
 * naming the flag, which is what an operator already watches. The alternative — booting happily and
 * dropping every delivery — is precisely the failure this check exists to remove.
 *
 * The API process is deliberately *not* checked. It connects on first publish rather than at
 * bootstrap, on purpose: building a container must not require a reachable Temporal, or every
 * script and test that only touches the database would. Turning that into a boot dependency to
 * report a misconfiguration the Worker already reports would be a worse trade.
 *
 * ## Why a describe rather than a start
 *
 * The gate is on the whole standalone-activity API, not on starting one, so a read is enough:
 * describing an activity id that cannot exist answers `NOT_FOUND` on a server with the flag and
 * `UNIMPLEMENTED` on a server without it. Verified against both — a self-hosted `temporalio/server`
 * 1.31.2 missing the flag, and the CLI dev server the tests boot, which has it. Starting a probe
 * activity would answer the same question by leaving an execution behind on every boot of every
 * replica.
 *
 * Reading the namespace's reported capabilities would be cheaper still and does not work: 1.31.2
 * does not report `standaloneActivities` at all, so an absent field cannot be told from a disabled
 * one and the check would refuse to boot a server that is perfectly configured.
 */

/** A probe id, not a real one. Nothing may ever be started under it. */
const PROBE_ACTIVITY_ID = 'proteus-events-preflight-probe'

/**
 * gRPC's own `UNIMPLEMENTED`, written out rather than imported from `@grpc/grpc-js` — that package
 * is a transitive dependency of the Temporal SDK and not one this backend declares, so importing it
 * here would be a phantom dependency that works only while the hoist happens to put it in reach.
 * The number is part of the gRPC wire protocol and does not move.
 */
const GRPC_UNIMPLEMENTED = 12

/**
 * Narrowed to the one call this makes, so the check can be exercised without a server and so it
 * carries no opinion about how the caller got its client.
 */
export type ActivityDescriber = (request: { namespace: string; activityId: string }) => Promise<unknown>

/**
 * Throws when the server has standalone activities turned off, and returns quietly otherwise.
 *
 * Only `UNIMPLEMENTED` is fatal. Every other failure — unreachable, unauthorized, a namespace that
 * does not exist — is left alone: the Worker is about to connect and poll for real, and that is a
 * better place to surface them than a preflight guessing at them. `NOT_FOUND` is the success case,
 * and it is what a working server answers for an id nothing has started.
 */
export async function assertStandaloneActivitiesEnabled(deps: {
  namespace: string
  describeActivityExecution: ActivityDescriber
}): Promise<void> {
  try {
    await deps.describeActivityExecution({ namespace: deps.namespace, activityId: PROBE_ACTIVITY_ID })
  } catch (error) {
    if (!isStandaloneActivitiesDisabled(error)) return

    throw new AppError({
      type: ErrorTypes.UNEXPECTED_STATE,
      message:
        `[events-worker] Temporal namespace "${deps.namespace}" has standalone activities disabled, so ` +
        'every event this deployment publishes would be dropped with only a log line — including the ' +
        'order confirmation a shopper is waiting for. Set `activity.enableStandalone: true` in the ' +
        "server's dynamic config (temporal/dynamicconfig/development-sql.yaml is this repo's own copy) " +
        'and restart this Worker. The server answered: ' +
        `"${describeGrpcError(error)}".`,
    })
  }
}

/**
 * The gRPC code rather than the message, because the message is the server's to reword. `NOT_FOUND`
 * — the answer from a server that has the API — is not this, and neither is a transport error.
 */
function isStandaloneActivitiesDisabled(error: unknown): boolean {
  return grpcCodeOf(error) === GRPC_UNIMPLEMENTED
}

/**
 * The SDK wraps a gRPC failure in a `ServiceError` whose `cause` carries the status, so the code can
 * be one level down. Both shapes are checked rather than assuming which client made the call.
 */
function grpcCodeOf(error: unknown): number | undefined {
  const candidates = [error, (error as { cause?: unknown })?.cause]
  for (const candidate of candidates) {
    const code = (candidate as { code?: unknown } | undefined)?.code
    if (typeof code === 'number') return code
  }
  return undefined
}

/** What the server itself said, so the message quotes it rather than paraphrasing it. */
function describeGrpcError(error: unknown): string {
  const candidates = [error, (error as { cause?: unknown })?.cause]
  for (const candidate of candidates) {
    const details = (candidate as { details?: unknown } | undefined)?.details
    if (typeof details === 'string' && details.length > 0) return details
  }
  return error instanceof Error ? error.message : String(error)
}
