/**
 * The queue every event dispatch lands on, and the one this bus polls.
 *
 * Separate from the workflow engine's `proteus` queue on purpose, not as tidiness. A flood of
 * `product.updated` subscribers and a shopper's `authorize-payment` step would otherwise compete for
 * the same Worker slots, and the checkout step is the one with a person waiting on it. A second
 * implicit queue costs nothing on Temporal — it exists the moment something polls it.
 */
export const EVENTS_TASK_QUEUE = 'proteus-events'

/**
 * The one Activity type this bus schedules. Every delivery is the same function; which subscriber
 * runs is an argument, not a name.
 *
 * The workflow engine takes the opposite approach — it registers one alias per step name so the
 * Temporal UI can label a row — and it can, because the driver only ever schedules a name the Worker
 * reported. Here the publisher and the Worker are two processes reading the same generated registry,
 * so a name-per-subscriber would turn a deploy that adds a subscriber into `ActivityNotFound` retries
 * on whichever side is older. `ActivityOptions.summary` carries the label instead, which the UI shows
 * and no dispatch depends on.
 */
export const DISPATCH_ACTIVITY_NAME = 'dispatchEvent'

/**
 * The ceiling this bus holds `activityId` — the dispatch identity — to.
 *
 * Temporal's own limit is `limit.maxIDLength`, whose server default is 1000; verified by starting an
 * activity with a 1001-character id and getting back `activityId exceeds length limit. Length=1001
 * Limit=1000`. This repo's own server is stricter: `temporal/dynamicconfig/development-sql.yaml`
 * pins 255. So 255 is the floor across the deployments this code actually reaches, and the number
 * the adapter checks against rather than discovering at start time — the SDK reports the rejection
 * as `Failed to start activity`, with the real reason a gRPC layer down.
 */
export const MAX_ACTIVITY_ID_LENGTH = 255

/**
 * Temporal's documented ceiling for `Priority.fairnessKey`, which this bus sets to the event name.
 * Checked for the same reason as the id length: an event name is a short constant today, and a
 * silent server-side rejection is a worse way to find out that changed.
 */
export const MAX_FAIRNESS_KEY_BYTES = 64
