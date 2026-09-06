import { createHash } from 'node:crypto'

/**
 * A rolling hash of the step names a handler has produced so far.
 *
 * Replay memoizes on call index, so a deploy that inserts, removes or reorders a `ctx.step` makes
 * an in-flight workflow's stored outputs line up against the wrong steps — in `complete-cart`
 * that is a charged card and no order. The driver carries the fingerprint of the sequence it has
 * already completed; the Activity recomputes it while replaying and refuses to go on if the two
 * disagree.
 *
 * Chained rather than hashed over the whole list at the end, because the check has to happen at
 * the exact index where the stored outputs run out — before the next action is executed, not
 * after.
 */
export function chainStepFingerprint(previous: string | null, stepName: string): string {
  return createHash('sha256')
    .update(`${previous ?? ''}/${stepName}`)
    .digest('hex')
    .slice(0, 16)
}
