import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cardFromMethodId, type StripeCard } from '../../stripe-factories.js'

/**
 * The cards the fake gateway is holding, and the intents it has open.
 *
 * This is the one place the fake remembers anything, and it is deliberate: a wallet *is* state.
 * "Save this card, then find it on your account page" is a fact about two requests, and no pure
 * function of a single request can express it. Faking our own `GET /store/payment-methods` to
 * paper over that was the wrong repair — it deleted the route, the module service, the ordering
 * rule and the ownership check from every test that touched a wallet.
 *
 * **On disk, not in a module-level `Map`, because a suite is more than one process.** The API
 * server opens the payment session; `complete-cart.ts` authorizes it, and that runs as a Temporal
 * activity in the *Worker* process. Both fetch `api.stripe.com` and both are intercepted, so
 * per-process state means the card is attached in one process and listed from another — the wallet
 * is written where nobody can read it. There is one Stripe, so there is one directory.
 *
 * **A file per customer and per intent, rather than one document**, because specs run
 * `fullyParallel`. A single JSON file is a read-modify-write from several processes at once, and
 * the update that loses the race disappears silently — which is a test failing for a reason that
 * has nothing to do with the code under test. Sharding by the key each write already has means
 * concurrent specs never touch the same file.
 *
 * It is not the shared simulator this replaced. That one had a control server specs drove over
 * HTTP, which coupled them to each other and forced them serial. Nothing here is addressable by a
 * spec: it is reached only by the gateway calls the code under test actually makes.
 */

/** One directory per suite — `e2e-config.ts` gives each its own, so runs cannot mix. */
const STATE_DIR = process.env.FAKE_GATEWAY_STATE ?? join(tmpdir(), 'proteus-fake-gateway')

export type FakeIntentRecord = { customer?: string; savesCard: boolean }

/** A Stripe id is already filename-safe, but a stray separator would escape the directory. */
const safe = (key: string) => key.replace(/[^A-Za-z0-9_-]/g, '_')

function readJson<T>(file: string): T | undefined {
  try {
    return JSON.parse(readFileSync(join(STATE_DIR, file), 'utf8')) as T
  } catch {
    // Absent, or a torn read against a concurrent write. Either way the gateway is holding nothing
    // it can prove, which is the same answer a fresh one would give.
    return undefined
  }
}

/**
 * Written through a temporary file and renamed, because two processes write here. `rename` is
 * atomic on the same filesystem, so a reader sees the whole previous document or the whole next
 * one — never half of either.
 */
function writeJson(file: string, value: unknown) {
  mkdirSync(STATE_DIR, { recursive: true })
  const scratch = join(STATE_DIR, `${file}.${process.pid}.tmp`)
  writeFileSync(scratch, JSON.stringify(value))
  renameSync(scratch, join(STATE_DIR, file))
}

const walletFile = (customer: string) => `wallet-${safe(customer)}.json`
const defaultFile = (customer: string) => `default-${safe(customer)}.json`
const intentFile = (id: string) => `intent-${safe(id)}.json`

function heldBy(customer: string): StripeCard[] {
  return readJson<StripeCard[]>(walletFile(customer)) ?? []
}

/** Every customer the fake is holding cards for — for the two calls that arrive without one. */
function customersHoldingCards(): string[] {
  try {
    return readdirSync(STATE_DIR)
      .filter((name) => name.startsWith('wallet-') && name.endsWith('.json'))
      .map((name) => name.slice('wallet-'.length, -'.json'.length))
  } catch {
    return []
  }
}

export const gatewayWallet = {
  rememberIntent(id: string, intent: FakeIntentRecord) {
    writeJson(intentFile(id), intent)
  },

  /** What an intent was opened with, so `retrieve` can answer the way Stripe would. */
  intentOf(id: string): FakeIntentRecord | undefined {
    return readJson<FakeIntentRecord>(intentFile(id))
  },

  /**
   * Attaches the card an intent was confirmed with, the way `setup_future_usage` does.
   *
   * Attached but **not yet redisplayable**, which is the whole point: on the current API version
   * Stripe leaves `allow_redisplay` at `unspecified`, and the customer-scoped listing filters
   * those straight back out. A card can be attached to a customer and invisible to every selector
   * — saved, in the sense that nobody can ever see it. Reproducing that is what makes the
   * provider's `markRedisplayable` load-bearing rather than decorative: delete it and the shopper
   * never sees the card they saved.
   */
  attach(customer: string, methodId: string) {
    const held = heldBy(customer)
    if (held.some((card) => card.id === methodId)) return
    // Appended, so `created` and insertion order agree and the module's "most recent first" has
    // something real to order by.
    writeJson(walletFile(customer), [
      ...held,
      // biome-ignore lint/style/useNamingConvention: the Stripe wire field
      { ...cardFromMethodId(methodId, held.length), allow_redisplay: 'unspecified' },
    ])
  },

  /** The second call the provider makes, and the one that lets a saved card be seen again. */
  markRedisplayable(methodId: string) {
    for (const customer of customersHoldingCards()) {
      const held = heldBy(customer)
      if (!held.some((card) => card.id === methodId)) continue
      writeJson(
        walletFile(customer),
        // biome-ignore lint/style/useNamingConvention: the Stripe wire field
        held.map((card) => (card.id === methodId ? { ...card, allow_redisplay: 'always' } : card)),
      )
    }
  },

  /** What the customer-scoped listing answers — which is not everything attached to them. */
  list(customer: string): StripeCard[] {
    return heldBy(customer).filter((card) => card.allow_redisplay !== 'unspecified')
  },

  /** The card, or `undefined` when this customer is not the one holding it. */
  find(customer: string, methodId: string): StripeCard | undefined {
    return gatewayWallet.list(customer).find((card) => card.id === methodId)
  },

  detach(methodId: string) {
    for (const customer of customersHoldingCards()) {
      const held = heldBy(customer)
      if (!held.some((card) => card.id === methodId)) continue
      writeJson(
        walletFile(customer),
        held.filter((card) => card.id !== methodId),
      )
      if (readJson<string>(defaultFile(customer)) === methodId) {
        rmSync(join(STATE_DIR, defaultFile(customer)), { force: true })
      }
    }
  },

  setDefault(customer: string, methodId: string) {
    writeJson(defaultFile(customer), methodId)
  },

  defaultOf(customer: string): string | null {
    return readJson<string>(defaultFile(customer)) ?? null
  },
}
