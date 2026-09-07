import type { Page, Route } from '@playwright/test'
import type { StorePaymentSession, StoreSavedMethod } from '@proteus/http-schemas/store'

/**
 * The storefront's own API, watched and stubbed from a spec.
 *
 * The backend runs in its own process with stateless Stripe handlers, so a spec cannot reach into
 * the gateway to seed a wallet or read a call log — and deliberately so: statelessness is what
 * lets these specs run `fullyParallel` against one backend. What a spec *can* reach is the
 * browser's own network, and every fact these specs are actually about crosses it.
 *
 * So the split is by layer, not by convenience:
 *
 * - **What the storefront does** — when it opens a payment session, which card it sends, what it
 *   renders from a wallet — is asserted here, from the browser's traffic.
 * - **What the server does with it** — the smallest-unit conversion, `capture_method: manual`,
 *   cancelling a superseded intent, writing the default onto the gateway customer — is asserted
 *   in `apps/backend/src/api/store/**\/__tests__`, where the gateway is observable directly and
 *   the assertions are sharper for it.
 *
 * Nothing here outlives the page it was given. There is no module state, and no spec can see
 * another's.
 */

/** A `GET /store/payment-methods` and the two writes against a single card. */
const WALLET_LIST = /\/store\/payment-methods(\?|$)/
const WALLET_CARD = /\/store\/payment-methods\/[^/?]+(\?|$)/
const WALLET_DEFAULT = /\/store\/payment-methods\/[^/?]+\/default(\?|$)/

/**
 * Fulfilled responses are subject to CORS like any other, and the storefront and the backend are
 * on different ports — so a stub that answered without these headers would be blocked by the
 * browser and read as a network failure rather than as the wallet it is. The preflight is answered
 * for the same reason: `DELETE` with a bearer token is not a simple request.
 */
function corsHeaders(route: Route): Record<string, string> {
  const origin = route.request().headers().origin ?? '*'
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
  }
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    headers: corsHeaders(route),
    body: JSON.stringify(body),
  })

/** The answer to a preflight, or `null` when the browser was asking for the resource itself. */
function answeredPreflight(route: Route): Promise<void> | null {
  if (route.request().method() !== 'OPTIONS') return null
  return route.fulfill({ status: 204, headers: corsHeaders(route), body: '' })
}

/** A wallet a spec put in front of one page, and the writes the page makes against it. */
export type StubbedWallet = {
  /** What the next read will answer, in the order it will answer them. */
  readonly cards: readonly StoreSavedMethod[]
  /** A card that arrives while the shopper is looking at the step — a second tab, a second device. */
  add(card: StoreSavedMethod): StoreSavedMethod
  /** A card that leaves the same way. The page is told nothing; it finds out at its next read. */
  remove(id: string): void
}

/** One `POST …/payment-sessions`: what the storefront asked for, and what it was handed back. */
export type OpenedSession = {
  /** The provider data blob the storefront sent — `paymentMethodId` and `savePaymentMethod`. */
  sent: Record<string, unknown>
  session: StorePaymentSession
}

/** The sessions one page opened, in order. */
export type OpenedSessions = {
  /** Settles the bodies still in flight, then answers. */
  all(): Promise<OpenedSession[]>
  /** The most recent one, for the common case of a single press. */
  last(): Promise<OpenedSession | undefined>
}

export const storeApi = {
  /**
   * A saved card in the shape `GET /store/payment-methods` returns.
   *
   * Typed as the real response entity rather than as a local shape, so a stub cannot drift from
   * what the route actually answers — the schema change would fail here first.
   */
  card(over: Partial<StoreSavedMethod> = {}): StoreSavedMethod {
    return {
      id: over.id ?? `pm_test_${Math.random().toString(36).slice(2, 10)}`,
      brand: over.brand ?? 'visa',
      last4: over.last4 ?? '4242',
      expMonth: over.expMonth ?? 12,
      expYear: over.expYear ?? new Date().getFullYear() + 3,
      isDefault: over.isDefault ?? false,
    }
  },

  /**
   * Answers this page's wallet reads and writes from a list the spec owns.
   *
   * The cards are returned in the order they are given, never re-sorted: "default first, then most
   * recent" is the backend's rule and is asserted there, and a stub that re-implemented it would
   * let both surfaces re-sort without anyone noticing. A spec that cares about order passes the
   * order it expects to see.
   */
  async stubWallet(page: Page, cards: StoreSavedMethod[] = []): Promise<StubbedWallet> {
    const wallet = [...cards]

    // Broadest first: Playwright tries the most recently added route first, so registering in
    // this order leaves `/default` matched before the bare id, and the bare id before the list.
    await page.route(WALLET_LIST, (route) => answeredPreflight(route) ?? json(route, { paymentMethods: wallet }))

    await page.route(WALLET_CARD, (route) => {
      const preflight = answeredPreflight(route)
      if (preflight) return preflight
      if (route.request().method() !== 'DELETE') return route.fallback()
      const id = idFromUrl(route.request().url())
      const index = wallet.findIndex((card) => card.id === id)
      if (index < 0) return json(route, { code: 'payment_method_unavailable' }, 409)
      wallet.splice(index, 1)
      return json(route, { id, deleted: true })
    })

    await page.route(WALLET_DEFAULT, (route) => {
      const preflight = answeredPreflight(route)
      if (preflight) return preflight
      const id = idFromUrl(
        route
          .request()
          .url()
          .replace(/\/default.*$/, ''),
      )
      const nominated = wallet.find((card) => card.id === id)
      if (!nominated) return json(route, { code: 'payment_method_unavailable' }, 409)
      // The route answers with the reordered wallet, which is what saves the page a second read.
      for (const card of wallet) card.isDefault = card === nominated
      wallet.splice(wallet.indexOf(nominated), 1)
      wallet.unshift(nominated)
      return json(route, { paymentMethods: wallet })
    })

    return {
      get cards() {
        return wallet
      },
      add(card) {
        wallet.push(card)
        return card
      },
      remove(id) {
        const index = wallet.findIndex((card) => card.id === id)
        if (index >= 0) wallet.splice(index, 1)
      },
    }
  },

  /** A wallet read that fails, for the fallback the shopper is dropped onto. */
  async failWallet(page: Page, status = 503): Promise<void> {
    await page.route(
      WALLET_LIST,
      (route) => answeredPreflight(route) ?? json(route, { code: 'service_unavailable' }, status),
    )
  },

  /**
   * Records every payment session this page opens.
   *
   * The press that opens one is the whole subject of these specs — "no intent until Place order",
   * "a second press supersedes the first", "the card the shopper pressed is the one sent" — and
   * all of it is legible right here, in the request the storefront made and the session it was
   * handed. Page-scoped, so a concurrent spec's presses are invisible to it and there is no
   * watermark to carry around.
   */
  watchPaymentSessions(page: Page): OpenedSessions {
    const opened: Promise<OpenedSession | null>[] = []

    page.on('response', (response) => {
      const request = response.request()
      if (request.method() !== 'POST' || !response.url().includes('/payment-sessions')) return
      if (!response.ok()) return

      opened.push(
        response
          .json()
          .then((body: { paymentSession?: StorePaymentSession }) => {
            const session = body.paymentSession
            if (!session) return null
            const sent = (request.postDataJSON() as { data?: Record<string, unknown> } | null)?.data ?? {}
            return { sent, session }
          })
          // A response whose body is gone — the page navigated away mid-flight — is not a session
          // this spec can assert on, and is not a reason to fail the recorder either.
          .catch(() => null),
      )
    })

    const settled = async () => (await Promise.all(opened)).filter((entry) => entry !== null)
    return {
      all: settled,
      async last() {
        return (await settled()).at(-1)
      },
    }
  },
}

/** The last path segment of a URL, with any query string dropped. */
function idFromUrl(url: string): string {
  return decodeURIComponent(url.split('?')[0]?.split('/').pop() ?? '')
}
