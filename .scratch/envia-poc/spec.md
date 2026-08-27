# Envia as a fulfillment provider — POC findings

**Status:** investigation complete, nothing implemented.
**Probed:** 2026-08-26, Envia sandbox (`api-test.envia.com`), Colombia only.
**Script:** `envia-poc.mjs` in this folder — every claim below is reproducible with `node .scratch/envia-poc/envia-poc.mjs --generate`.
**Carrier table:** `carriers.md` (vendor docs snapshot, 2026-07-07).

The question this answers: can Envia sit behind
`apps/backend/src/core/types/fulfillment/provider.ts` (`IFulfillmentProvider`) without
distorting the port?

Short answer: five of the seven methods fit as-is. `calculatePrice` does not, and that
one is load-bearing. A decision is needed on it before any code gets written — see
[Decision required](#decision-required).

---

## 1. Environment

| | |
| --- | --- |
| Shipping API | `https://api-test.envia.com` (sandbox), `https://api.envia.com` (prod) |
| Queries API | `https://queries.envia.com` — **production only** |
| Geocodes API | `https://geocodes.envia.com` — no environment split, no auth needed |
| Auth | `Authorization: Bearer <token>`; separate tokens per environment |

**There is no sandbox Queries API.** `queries-test.envia.com`, which every webhook
example in the vendor docs uses, does not resolve — it answers with Heroku's "No such
app" page. The production host rejects the sandbox token with `401 User token is
invalid` on every authenticated route. Only `/webhook-types` answers, because it needs
no auth at all.

This single fact causes two of the gaps below (carrier catalogue, webhook
registration). Both are testable with a production token; neither is testable now.

### Response conventions worth knowing

- Errors come back under **HTTP 200** as `{ meta: 'error', error: { code, message } }`.
  The status line tells you nothing; parse the body.
- Success is `{ meta: '<operation>', data: [...] }`.
- Missing-field validation is inconsistent. `/ship/generate` names the missing property
  cleanly; `/ship/track` throws raw PHP (`Undefined property: stdClass::$service`, then
  `$locale`) one field at a time.

---

## 2. Fit against `IFulfillmentProvider`

| Method | Verdict | Basis |
| --- | --- | --- |
| `getIdentifier` | fits | trivial |
| `getFulfillmentOptions` | **partial** | no readable catalogue in sandbox; list must be hardcoded |
| `validateFulfillmentData` | fits | has a genuine job in CO — see [DANE codes](#31-addresses-carry-a-dane-code-not-a-city-name) |
| `validateOption` | fits | local check against the hardcoded list |
| `canCalculate` | fits | always `true`; Envia rates are always live |
| `calculatePrice` | **mismatch** | see [Decision required](#decision-required) |
| `createFulfillment` | fits | tracking number, label PDF and track URL all fit the opaque `{ data }` blob |
| `cancelFulfillment` | fits (caveat) | verified end to end with a balance refund; refusals are carrier-dependent |

Verified end to end on the sandbox: quote → buy label → track → cancel, with
`refundedAmount: 60, balanceReturned: 1` on the cancel.

### `cancelFulfillment` caveat

The port returns `Promise<void>`, so a refused cancel has nowhere to go. Refusal is
normal and carrier-dependent — a UPS label refused with `1120 Shipment label could not
be canceled` on the Mexico lane, while interRapidisimo cancelled cleanly. The
implementation must not throw on refusal, which means the caller cannot distinguish
"cancelled" from "carrier said no".

---

## 3. Colombia specifics

### 3.1 Addresses carry a DANE code, not a city name

The rate call rejects a human-readable city. `destination.city` must be the **8-digit
DANE municipal code** (`11001000` Bogotá, `05001000` Medellín). The Geocodes API is the
only source: `GET /zipcode/CO/{postalCode}` returns it as `info.stat_8digit`, along with
the 2-digit state code and the valid `suburbs` list for that postal code.

This gives `validateFulfillmentData` real work: postal code in, DANE code + state out.

**Trap:** an unknown postal code returns `200 []`, not an error. Validity means "the
array is non-empty".

### 3.2 Carrier slugs are camelCase and unforgiving

`interRapidisimo`, `serviEntrega`, `noventa9Minutos`, `mensajerosUrbanos`, `lastMile`.

Every wrong spelling — `inter_rapidisimo`, `99minutos`, `mensajeros_urbanos` — returns
`1101 Carrier provided is not supported`, which is the **same error a genuinely
nonexistent carrier returns**. A typo is indistinguishable from an unsupported carrier.
An early pass of this POC "discovered" five unsupported carriers that were only
misspelled.

### 3.3 Coverage is per-lane, and 8 of 11 documented carriers quote

Two lanes probed: inter-city (Bogotá→Medellín) and intra-city (Bogotá→Bogotá).

| Carrier | Inter-city | Intra-city |
| --- | --- | --- |
| coordinadora, dhl, fedex, interRapidisimo, serviEntrega | ✅ | ✅ |
| tcc | ✅ | ✅ |
| mensajerosUrbanos | ❌ no coverage | ✅ |
| noventa9Minutos | ❌ no coverage | ✅ |
| cabify | ❌ `1105` | ❌ `1105` |
| deprisa | ❌ `1125` | ❌ `1125` |
| lastMile | ❌ `1129` | ❌ `1129` |

The on-demand couriers only serve a single city, so a single-lane probe understates the
carrier list. **A static option list is therefore wrong in principle** — coverage is a
property of the lane, not of the account.

The three that never quote are *recognised* (not `1101`) but their errors contradict the
lane tested: Cabify returns "only local coverage in Bogotá and Medellín" **on a
Bogotá→Bogotá shipment**, LastMile returns "cobertura solo en bogotá" **on a Bogotá
shipment**. Adding coordinates and explicit services changed nothing. Most likely not
enabled on this sandbox account rather than a real coverage limit — **confirm with
Envia**.

FedEx quotes but cannot generate a label on this account:
`SHIPMENT.ACCOUNTNUMBER.UNAUTHORIZED`. ServiEntrega likewise fails at label time with a
carrier login error. Quoting and buying are separately gated.

### 3.4 Error codes must be classified, not merely logged

`tcc` quoted successfully on one run and failed five times out of five on a direct retry
twenty minutes later with `1300 External dependency failed — Bad Gateway`. Recording
that as "does not serve this lane" would be wrong.

| Class | Codes | Provider behaviour |
| --- | --- | --- |
| config | `1101` | wrong slug — fix the code |
| coverage | `1105`, `1126`, `1129`, `1146` | carrier cannot serve this lane — hide the option |
| outage | `1300`, timeouts | carrier's upstream is down — retry or degrade, conclude nothing |

`1125` is overloaded — "service not available" on rate, "no tracking information found"
on tracking — and cannot be classified from the code alone.

**Consequence:** a carrier silently drops out of the option list whenever its upstream is
down. Coverage cannot be cached as a static fact.

---

## 4. Tracking and order state

No `IFulfillmentProvider` method covers tracking; the port ends at cancel.

`POST /ship/generaltrack/` with `{ trackingNumbers: [...] }` returns everything needed to
drive order state: `status` (28 documented values from Created through Out for Delivery,
Delivery Attempt, Delivered, Address error, Lost, Rejected), `estimatedDelivery`,
`shippedAt`, `deliveredAt`, `signedBy`, `podFile` / `podEvidences` (proof of delivery),
plus `trackUrl` and the carrier's own `trackUrlSite`.

Use `/ship/generaltrack/`, **not** `/ship/track` — the latter is a broken legacy route.

**Unverified:** `eventHistory` was empty on every sandbox label, because test shipments
are never scanned by a carrier. The shape of an individual scan event is the one thing
this POC could not observe.

### 4.1 Webhooks exist; registration is untestable here

Five event types, read live from `queries.envia.com/webhook-types`:

| id | name | payload |
| --- | --- | --- |
| 1 | `onShipmentStatusUpdate` | `{ carrierName, trackingNumber, status }` |
| 2 | `statusUpdateWithEcommerceInfo` | + `movementDate`, `orderData { shopId, orderIdentifier, orderNumber, orderName }` |
| 3 | `simpleTracking` | v2 of 1, HMAC-signed |
| 4 | `ecommerceTracking` | v2 of 2, HMAC-signed |
| 5 | `surcharge` | post-hoc billing adjustments (e.g. overweight) |

Types 3–5 send `X-Webhook-Signature: v1=HMAC-SHA256(ts + "." + event + "." + body,
secret)` plus `X-Webhook-Event/Version/Id/Timestamp`. Endpoints must answer 2xx within 5
seconds and be idempotent — duplicate deliveries are expected.

Registration needs an authenticated Queries call, so it **cannot be tested without a
production token** (see [Environment](#1-environment)).

The payload carries a status string and nothing else — no location, no detail. In
practice a webhook is a **trigger to call `generaltrack`**, not the data itself.

Type 5 (`surcharge`) is worth noting independently of tracking: Envia can bill *after*
the fact, so the amount charged at label time is not final.

### 4.2 Live shipment location is not available

Every field of a real tracking response was enumerated: **85 fields, zero geographic**.
All 106 vendor documentation pages were swept; only five mention latitude/longitude, and
none is tracking — geocodes, rate *input* coordinates, carrier branches, locate-city,
validate-zip-code. No tracking or webhook page mentions geolocation at all.

Envia relays discrete carrier scan events, not GPS. A live "where is my parcel" map is
not achievable from this API.

What *is* mappable, if that UI is wanted:

- **Drop-off / pickup points** — `carrier-branches` returns coordinates and ranks
  branches by Haversine distance within 50 km, with a `distance` field. Directly
  relevant here: interRapidisimo's cheapest services are `mensajeria_od`
  (Oficina→Domicilio), so "collect at this office" is a real flow.
- **A coarse progress line** — geocode origin and destination postal codes and draw the
  route with a status marker. Illustrative, not live.

---

## 5. Decision required

`calculatePrice(optionData, data, context) → { amount }` is called **once per option**
and returns **one number**. Envia works the other way around:

- `shipment.carrier` is **required** on `/ship/rate` — there is no quote-everything call.
  Omitting it returns `400 Required property missing: carrier`.
- One call per carrier returns *many* service rates. On the inter-city lane, 11 calls
  returned 16–17 rates; `interRapidisimo` alone returned 10.

Two consequences:

**Redundant fetching.** Pricing 17 options one at a time is 17 requests where 11 would
do, and the waste is concentrated: the 10 interRapidisimo options become 10 identical
requests that each return the same 10 rows, 9 discarded every time.

**Discarded data.** A rate carries ~37 fields; only `totalPrice` survives as `amount`.
Lost with it: `serviceDescription` (the human label), `deliveryDate` / `deliveryEstimate`,
`currency`, and the itemised `costSummary` (fuel, extended-zone surcharges). Contrast
`createFulfillment`, which returns `{ data: Record<string, unknown> }` — that opaque blob
is exactly why tracking number, label and track URL fit with no port change.
`calculatePrice` has no equivalent escape hatch.

This is not academic. On the intra-city lane three interRapidisimo options priced at
**exactly 60 COP each**, distinguished only by `serviceDescription` and delivery date.
Through the current port they are indistinguishable to the customer.

### Options

1. **Batch method on the port** — add `calculatePrices(options[], context)` alongside the
   existing one. Matches Envia's grain directly. Widest blast radius: every provider and
   every caller.
2. **Request-scoped cache in the provider** — fan out once per cart, memoise by
   `(cartId, address, packages)`, serve each `calculatePrice` from it. No port change,
   but correctness now depends on cache keying, and the discarded-fields problem remains.
3. **Widen the return type** to `{ amount, data? }` — solves the lost metadata, not the
   redundant fetching. Composable with option 2.

Not recommending one here — it is a port-design decision that outlives Envia, and option
1 changes an interface the manual provider also implements.

---

## 6. Open questions

Each needs a production token or a vendor answer; none blocks the decision above.

1. Are cabify, deprisa and lastMile enabled on our account, or genuinely unavailable?
   Their error messages contradict the lanes tested.
2. What does a populated `eventHistory` entry contain — in particular, does a scan event
   carry a place name? If so, geocoding it yields a scan-level map (§4.2).
3. Does the Queries API `carrier` / available-carriers endpoint return per-origin
   coverage? If it does, `getFulfillmentOptions` has a real source and §3.3's
   "static list is wrong" problem partly dissolves.
4. Why do FedEx and ServiEntrega quote but fail at label generation on this account?
5. How often does type 5 (`surcharge`) fire in practice — i.e. how far can the final
   charge drift from the quoted price?
