import type { Page, Response } from '@playwright/test'

/**
 * How long a page is given to go quiet before the spec carries on regardless.
 *
 * Long enough that a page which settles at all has settled, short enough that it cannot eat a
 * spec's whole budget.
 */
const SETTLE_MS = 5_000

/**
 * Navigates, then gives the page a moment to go quiet — without ever waiting on it.
 *
 * `waitUntil: 'networkidle'` is what these suites used to pass, and it fails in the wrong
 * direction: it needs 500ms in which the dev server sends nothing, which a machine running six
 * suites at once does not offer. Two `verify:full` runs died on a product page that was rendered,
 * hydrated and showing the right price — the spec had nothing left to wait for and timed out
 * anyway. Playwright discourages the wait for this reason.
 *
 * Quiet is still worth asking for, which is why this is not a plain `goto`: a spec that clicks
 * straight after navigating is clicking a control React may not have hydrated. So it is a
 * courtesy with a deadline. What makes that safe is that every spec here asserts something after
 * navigating, and assertions retry — the page being slow costs seconds, not a failure.
 */
export async function gotoSettled(page: Page, url: string): Promise<Response | null> {
  const response = await page.goto(url)
  await page.waitForLoadState('networkidle', { timeout: SETTLE_MS }).catch(() => undefined)

  return response
}
