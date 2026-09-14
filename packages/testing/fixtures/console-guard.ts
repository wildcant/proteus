import type { ConsoleMessage, Page } from '@playwright/test'

/**
 * Console output a page is allowed to produce, each with the reason it cannot be fixed from here.
 *
 * Nothing our own code logs belongs on this list. A React or Base UI warning is a defect in the
 * component that rendered, and the whole point of the guard is that it fails rather than scrolls
 * past. The one case where our own output is excused is `allow` below, which a spec calls for a
 * line it asserts on itself.
 */
const ALLOWED = [
  // Stripe.js says this on every page that loads it, because the test server is HTTP. The live
  // integration is HTTPS; there is no flag to quiet the notice.
  /You may test your Stripe\.js integration over HTTP/,
  // The browser logs every non-2xx response whether or not the app handled it correctly, so a
  // suite that drives an error path — a declined payment, an expired token, a deleted record —
  // prints one of these while asserting the very screen it produced. What the app did about it is
  // the assertion's business; that the request failed is not news.
  /Failed to load resource: the server responded with a status of/,
]

/** Vite tells the page it connected, and says so at `error` level when the dev server restarts. */
const VITE_HMR = /^\[vite\]/

function isAllowed(text: string) {
  return VITE_HMR.test(text) || ALLOWED.some((pattern) => pattern.test(text))
}

export type ConsoleWatch = {
  /**
   * Excuses a line this spec produces on purpose, and hands back what it matched.
   *
   * The list above is for output no test can prevent; this is the opposite case — a decline the
   * storefront logs deliberately, where the spec's own claim is that it said which decline it was.
   * One call carries both halves of that: the excuse stays next to the assertion instead of in a
   * global list every other spec inherits, and the assertion reads the same lines the guard saw
   * rather than opening a second listener of its own.
   */
  allow: (pattern: RegExp) => () => string[]
  /** Everything the page complained about that nothing excused. */
  complaints: () => string[]
}

/**
 * Collects everything the page complained about, so a test can fail on it at teardown.
 *
 * Attach before the first navigation — a listener added later misses the warnings React emits
 * while mounting, which are most of the ones worth catching.
 */
export function watchConsole(page: Page): ConsoleWatch {
  const logged: string[] = []
  const excused: RegExp[] = []

  page.on('console', (message: ConsoleMessage) => {
    const type = message.type()
    if (type !== 'error' && type !== 'warning') return

    const text = message.text()
    if (isAllowed(text)) return

    // First line only: React appends the whole owner stack, which runs to 40 lines and buries the
    // next complaint in the list.
    logged.push(`${type}: ${text.split('\n')[0]}`)
  })

  // An exception that escaped a handler never reaches `console`, and is always a defect.
  page.on('pageerror', (error) => {
    logged.push(`uncaught: ${error.message.split('\n')[0]}`)
  })

  return {
    allow: (pattern: RegExp) => {
      excused.push(pattern)
      return () => logged.filter((line) => pattern.test(line))
    },
    // Filtered at teardown rather than as each line arrives, so a spec may declare its excuse
    // anywhere in the body — including after the press that produces the line.
    complaints: () => logged.filter((line) => !excused.some((pattern) => pattern.test(line))),
  }
}
