import { ApiError } from '#/api/fetcher'

/**
 * The API's answer for a saved card that cannot be paid with, in the port's own vocabulary.
 *
 * `payment_method_unavailable` on a `409` is our server's code, not a gateway's, so an adapter
 * must not have to recognise it — the checkout owns `createSession` and therefore owns
 * classifying what it refuses with. What crosses into the adapter is this class, which it answers
 * with `{ kind: 'staleMethod' }` and nothing else.
 *
 * Keyed on the code rather than the message: the copy is a shopper-facing string that someone
 * will reword, and a branch that reads it would fail silently the day they do.
 */
const PAYMENT_METHOD_UNAVAILABLE = 'payment_method_unavailable'

export class StaleMethodError extends Error {
  /**
   * A field rather than only a class, because classes are structural in TypeScript: `Error` and a
   * subclass that adds nothing are the same type, so narrowing on `instanceof` would leave the
   * *other* branch as `never` and `error.message` would stop compiling for every caller.
   */
  readonly isStaleMethod = true

  constructor() {
    super('That payment method is no longer available.')
    this.name = 'StaleMethodError'
  }
}

export function isStaleMethodError(error: unknown): error is StaleMethodError {
  return error instanceof StaleMethodError
}

/**
 * Raises `StaleMethodError` for the one refusal the wallet can recover from, and rethrows the
 * rest untouched.
 *
 * The reachable path is not a broken client: a shopper whose session expires between the selector
 * rendering and Place order being pressed arrives naming a card the server can no longer see.
 */
export function rethrowAsStaleMethod(error: unknown): never {
  if (error instanceof ApiError && error.status === 409 && error.code === PAYMENT_METHOD_UNAVAILABLE) {
    throw new StaleMethodError()
  }
  throw error
}
