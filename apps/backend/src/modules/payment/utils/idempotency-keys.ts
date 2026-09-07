/**
 * The keys the module hands the gateway for every write it makes.
 *
 * A key generated per call is not an idempotency key. The retry that matters is the one after a
 * crash or a timeout, where the first attempt may already have taken the money — and a freshly
 * generated key on that attempt takes it again. So every key here is derived from a row that
 * exists in our database *before* the gateway is called, and the same logical operation therefore
 * presents the same key however many processes it takes to finish.
 *
 * The `write` prefix is not decoration. Stripe scopes a key to the whole account and rejects a
 * key replayed with different parameters, so two different operations against one session row
 * must not collide on that row's id.
 */
export type GatewayWrite = 'initiate' | 'update' | 'capture' | 'cancel' | 'refund' | 'accountHolder'

/**
 * `rowId` must be a durable identifier — a Payment Session, Capture or Refund id — never a value
 * computed for this call. `variant` distinguishes writes that legitimately repeat against the
 * same row with different parameters: an update to 25.00 and an update to 30.00 are two
 * operations, and reusing one key for both is what Stripe rejects.
 */
export function idempotencyKeyFor(write: GatewayWrite, rowId: string, ...variant: string[]): string {
  return [write, rowId, ...variant].join(':')
}
