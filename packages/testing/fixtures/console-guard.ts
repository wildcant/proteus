import type { ConsoleMessage, Page } from '@playwright/test'

/**
 * Console output a page is allowed to produce, each with the reason it cannot be fixed from here.
 *
 * Nothing our own code logs belongs on this list. A React or Base UI warning is a defect in the
 * component that rendered, and the whole point of the guard is that it fails rather than scrolls
 * past.
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

/**
 * Collects everything the page complained about, so a test can fail on it at teardown.
 *
 * Attach before the first navigation — a listener added later misses the warnings React emits
 * while mounting, which are most of the ones worth catching.
 */
export function watchConsole(page: Page) {
  const complaints: string[] = []

  page.on('console', (message: ConsoleMessage) => {
    const type = message.type()
    if (type !== 'error' && type !== 'warning') return

    const text = message.text()
    if (isAllowed(text)) return

    // First line only: React appends the whole owner stack, which runs to 40 lines and buries the
    // next complaint in the list.
    complaints.push(`${type}: ${text.split('\n')[0]}`)
  })

  // An exception that escaped a handler never reaches `console`, and is always a defect.
  page.on('pageerror', (error) => {
    complaints.push(`uncaught: ${error.message.split('\n')[0]}`)
  })

  return complaints
}
