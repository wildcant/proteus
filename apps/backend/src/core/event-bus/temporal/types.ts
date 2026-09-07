import type { SerializedError } from '../../../temporal/failure-details.js'
import type { Event } from '../events.js'

/**
 * The wire contract between the publisher that starts a standalone activity and the events Worker
 * that runs it. Types only.
 *
 * There is no driver and no replay here, which is the whole of what standalone activities buy: one
 * value goes over, one function runs, and nothing about the workflow engine's execution machinery is
 * involved. Compare `core/workflows/temporal/types.ts`, which needs an outputs array and a shape
 * fingerprint to make a *resumable* execution work.
 */

/**
 * One delivery. The subscriber is named rather than sent, because a function cannot cross a wire —
 * the Worker looks the name up in the same generated registry the publisher consulted.
 */
export type DispatchEventInput = {
  subscriber: string
  event: Event
}

/** `ApplicationFailure.type` for every failure the dispatch activity raises. */
export const SUBSCRIBER_FAILURE_TYPE = 'ProteusSubscriberFailure'

/**
 * What that failure carries. Nothing reads it back into a JavaScript error the way the workflow
 * adapter does — a publisher never awaits a delivery, so there is no caller to rebuild it for. It is
 * written through the shared `serializeError` anyway, so the one encoding of an error crossing this
 * boundary stays one encoding: an operator reading a failed activity in the Temporal UI sees the
 * same `type`/`code` fields a failed workflow step shows.
 */
export type SubscriberFailureDetail = {
  subscriber: string
  dispatchId: string
  error: SerializedError
}
