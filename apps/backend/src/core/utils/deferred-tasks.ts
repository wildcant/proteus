import type { Logger } from '../types/logger.js'

export type DeferredTasksConfig = {
  /** How long a task waits before its first attempt. */
  delayMs: number
  /** Total attempts, including the first. */
  attempts: number
  /** Wait before the second attempt; doubled for each one after it. */
  backoffMs: number
}

/**
 * Runs work after the response that asked for it has already gone out.
 *
 * The one caller today is the payment webhook route, which has to answer the gateway before it
 * processes anything: a webhook routinely overtakes the shopper's own checkout request, and
 * processing it immediately means processing a cart that has not been completed yet. The
 * reference implementation gets the delay and the retries from an event bus; this is the same
 * behaviour without the module, which is a deliberate divergence recorded in the spec.
 *
 * **Tasks sharing a name run one after another, never at once.** Deferral turns two deliveries of
 * the same event into two concurrent runs, and the guards that make webhook processing safe to
 * repeat — "is there anything left to capture?" — are read-then-write and lose that race. Ordering
 * by name closes it inside one process. It is not a distributed lock, and the spec is explicit
 * that this codebase does not have one yet: two API instances behind a load balancer can still
 * take the same event at the same moment.
 *
 * What it deliberately is not: durable. A process that dies with tasks pending loses them, and
 * the gateway's own redelivery is what covers that.
 */
export class DeferredTasks {
  #config: DeferredTasksConfig
  #logger: Logger
  #inFlight = new Set<Promise<void>>()
  #queues = new Map<string, Promise<void>>()

  constructor(config: DeferredTasksConfig, logger: Logger) {
    this.#config = config
    this.#logger = logger
  }

  /**
   * Schedules `task` and returns immediately. Failures are retried, then logged and dropped.
   *
   * `name` is a serialization key as well as a label: pick one that identifies the *thing* being
   * worked on — a session id, not a delivery id — or two tasks that must not overlap will.
   */
  run(name: string, task: () => Promise<void>): void {
    const queued = this.#queues.get(name) ?? Promise.resolve()
    const settled = queued.then(() => this.#attempt(name, task))

    this.#queues.set(name, settled)
    this.#inFlight.add(settled)

    settled.finally(() => {
      this.#inFlight.delete(settled)
      // Only the tail clears the queue. An earlier link finishing must not drop the successor
      // that is still waiting behind it.
      if (this.#queues.get(name) === settled) this.#queues.delete(name)
    })
  }

  /**
   * Resolves once everything scheduled so far has finished, including tasks that a running one
   * schedules in turn. For shutdown, and for tests that would otherwise have to poll.
   */
  async drain(): Promise<void> {
    while (this.#inFlight.size > 0) {
      await Promise.all([...this.#inFlight])
      // Yields so the `finally` handlers above empty the set before it is measured again.
      await Promise.resolve()
    }
  }

  async #attempt(name: string, task: () => Promise<void>): Promise<void> {
    await sleep(this.#config.delayMs)

    for (let attempt = 1; attempt <= this.#config.attempts; attempt++) {
      try {
        await task()
        return
      } catch (error) {
        const last = attempt === this.#config.attempts
        this.#logger.error(
          `[deferred] "${name}" failed on attempt ${attempt}/${this.#config.attempts}${last ? ', giving up' : ''}`,
        )
        this.#logger.error(error instanceof Error ? error : String(error))
        if (last) return
        await sleep(this.#config.backoffMs * 2 ** (attempt - 1))
      }
    }
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
