// /**
//  * Envia sandbox probe — does their e-commerce checkout API fit IFulfillmentProvider?
//  *
//  * Colombia only. Each probe is named after the interface method it would back, so the
//  * output reads as a fit report rather than a dump of API responses.
//  *
//  *   node .scratch/envia-poc/envia-poc.mjs                 # read-only probes
//  *   node .scratch/envia-poc/envia-poc.mjs --generate      # also buys a label, tracks it, cancels it
//  *
//  * Probes 5 and 7 cover tracking and webhooks. No IFulfillmentProvider method owns
//  * either, so they report on what Envia can feed order state instead.
//  *
//  * Token comes from ENVIA_TOKEN, falling back to the sandbox token below.
//  */

// const TOKEN = process.env.ENVIA_TOKEN

// const API = 'https://api-test.envia.com'
// const QUERIES = 'https://queries.envia.com' // no -test host exists; see probe 1
// const GEOCODES = 'https://geocodes.envia.com'

// const GENERATE_LABEL = process.argv.includes('--generate')

// const CURRENCY = 'COP'

// // One carrier can hang for 20s+. Past that we would rather show the customer the rates
// // we do have than hold checkout open, so every rate call gets its own deadline.
// const RATE_TIMEOUT_MS = 8_000

// /**
//  * Every Colombian carrier in the Envia docs table, with the slug the API actually
//  * accepts. Slugs are camelCase and unforgiving: `inter_rapidisimo`, `99minutos` and
//  * `mensajeros_urbanos` all return 1101 "Carrier provided is not supported" — the same
//  * error a genuinely nonexistent carrier returns, so a typo here is indistinguishable
//  * from an unsupported carrier.
//  */
// const CO_CARRIERS = [
//   'cabify',
//   'coordinadora',
//   'deprisa',
//   'dhl',
//   'fedex',
//   'interRapidisimo',
//   'lastMile',
//   'mensajerosUrbanos',
//   'noventa9Minutos',
//   'serviEntrega',
//   'tcc',
// ]

// /**
//  * Two lanes, because carrier coverage in Colombia is per-lane rather than per-account:
//  * the on-demand couriers only quote inside a single city. Probing one lane would make
//  * the usable carrier list look shorter than it is.
//  *
//  * `city` is NOT a city name in Colombia — it must be the 8-digit DANE municipal code.
//  * The Geocodes API hands it over as `info.stat_8digit` (11001000 = Bogota,
//  * 05001000 = Medellin), which is exactly the translation validateFulfillmentData does.
//  */
// const BOGOTA_WAREHOUSE = {
//   name: 'Proteus Bodega',
//   company: 'Proteus',
//   email: 'bodega@proteus.test',
//   phone: '3001234567',
//   street: 'Carrera 7',
//   number: '71-21',
//   district: 'Usaquen',
//   city: '11001000',
//   state: 'DC',
//   country: 'CO',
//   postalCode: '110111',
//   reference: '',
// }

// const LANES = [
//   {
//     label: 'inter-city Bogota->Medellin',
//     origin: BOGOTA_WAREHOUSE,
//     destination: {
//       name: 'Juana Cliente',
//       company: '',
//       email: 'juana@example.test',
//       phone: '3009876543',
//       street: 'Carrera 43A',
//       number: '1-50',
//       district: 'El Poblado',
//       city: '05001000',
//       state: 'AN',
//       country: 'CO',
//       postalCode: '050001',
//       reference: '',
//     },
//   },
//   {
//     label: 'intra-city Bogota->Bogota',
//     origin: BOGOTA_WAREHOUSE,
//     destination: {
//       name: 'Juana Cliente',
//       company: '',
//       email: 'juana@example.test',
//       phone: '3009876543',
//       street: 'Calle 13',
//       number: '38-20',
//       district: 'Puente Aranda',
//       city: '11001000',
//       state: 'DC',
//       country: 'CO',
//       postalCode: '111611',
//       reference: '',
//     },
//   },
// ]

// // One box. In the real provider this is derived from the cart's line items.
// const PACKAGES = [
//   {
//     content: 'Merchandise',
//     amount: 1,
//     type: 'box',
//     weight: 1.5,
//     insurance: 0,
//     declaredValue: 50_000,
//     weightUnit: 'KG',
//     lengthUnit: 'CM',
//     dimensions: { length: 20, width: 15, height: 10 },
//   },
// ]

// // -- HTTP --

// async function call(url, { method = 'GET', body, timeoutMs } = {}) {
//   const started = Date.now()
//   try {
//     const response = await fetch(url, {
//       method,
//       headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
//       body: body ? JSON.stringify(body) : undefined,
//       signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
//     })

//     const text = await response.text()
//     let payload
//     try {
//       payload = JSON.parse(text)
//     } catch {
//       payload = { raw: text.slice(0, 300) }
//     }

//     return { ok: response.ok, status: response.status, elapsed: Date.now() - started, payload }
//   } catch (error) {
//     // A timeout is a result, not a crash — it is exactly what we are trying to measure.
//     return { ok: false, status: 'timeout', elapsed: Date.now() - started, payload: null, timedOut: true, error }
//   }
// }

// // -- Reporting --

// const findings = []

// function report(method, verdict, note) {
//   findings.push({ method, verdict, note })
// }

// function heading(title) {
//   console.log(`\n${'='.repeat(96)}\n${title}\n${'='.repeat(96)}`)
// }

// function show(label, value) {
//   console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}`)
// }

// // Envia wraps success as { meta, data } and errors as { meta: 'error', error: {...} },
// // both under HTTP 200 — the status line alone tells you nothing.
// function enviaError(payload) {
//   if (!payload || typeof payload !== 'object') return null
//   if (!payload.error) return null
//   return typeof payload.error === 'string'
//     ? payload.error
//     : `${payload.error.code} ${payload.error.message ?? ''}`.trim()
// }

// /**
//  * Envia returns every failure as an "Invalid Option" with a numeric code, but the codes
//  * mean very different things to a provider implementation:
//  *
//  *   config     the slug is wrong, or the carrier does not exist — fix the code
//  *   coverage   this carrier genuinely cannot serve this lane — hide the option
//  *   outage     the carrier's own API is down — retry, or degrade, but do not conclude
//  *              anything about coverage from it
//  *
//  * Conflating outage with coverage is how a POC "discovers" that a carrier is
//  * unsupported when it is merely having a bad afternoon: tcc quoted fine on one run and
//  * returned 1300 Bad Gateway five times in a row on the next.
//  */
// function classifyError(error) {
//   if (!error) return null
//   if (error.startsWith('1101')) return 'config'
//   if (error.startsWith('1300') || error.includes('timed out')) return 'outage'
//   if (/^(1105|1126|1129|1146)/.test(error)) return 'coverage'
//   return 'unknown'
// }

// // -- Probes --

// /**
//  * getFulfillmentOptions(): the interface wants a list of shippable options resolved
//  * once at registration, with no cart in hand. Envia documents a Queries API for exactly
//  * this ("Get Available Carriers" — carriers available for a given origin), so the
//  * question is whether a sandbox integration can read it.
//  */
// async function probeCarrierCatalogue() {
//   heading('1. getFulfillmentOptions()  —  GET /carrier (Queries API)')

//   const carriers = await call(`${QUERIES}/carrier`)
//   show('status', `${carriers.status} in ${carriers.elapsed}ms`)
//   show('payload', carriers.payload)

//   if (!carriers.ok || enviaError(carriers.payload)) {
//     report(
//       'getFulfillmentOptions',
//       'PARTIAL',
//       `Queries API rejects the sandbox token (${carriers.status}) and has no -test host — ` +
//         'the option list has to be hardcoded (CO_CARRIERS) or read with a production token',
//     )
//     return []
//   }

//   const list = carriers.payload.data ?? carriers.payload
//   report('getFulfillmentOptions', 'FITS', `${list.length} carriers enumerable at boot`)
//   return list
// }

// /**
//  * validateFulfillmentData(): the interface's chance to normalise what the storefront
//  * submitted before it is stored on the shipping method. In Colombia this method has a
//  * real job rather than a nominal one — the rate call refuses a human city name and
//  * demands the 8-digit DANE code, and only the Geocodes API knows the mapping.
//  */
// async function probeAddressValidation() {
//   heading('2. validateFulfillmentData()  —  GET /zipcode/CO/{postalCode} (Geocodes API)')

//   const { destination } = LANES[0]
//   const good = await call(`${GEOCODES}/zipcode/CO/${destination.postalCode}`)
//   show('status', `${good.status} in ${good.elapsed}ms`)

//   const [place] = Array.isArray(good.payload) ? good.payload : []
//   if (place) {
//     show('normalised for the rate call', {
//       city: place.info?.stat_8digit, // the DANE code the rate call demands
//       state: place.state?.code?.['2digit'],
//       country: place.country?.code,
//       postalCode: place.zip_code,
//       locality: place.locality,
//       suburbs: place.suburbs,
//     })
//     console.log(`\nDANE code matches the one hardcoded in the lane: ${place.info?.stat_8digit === destination.city}`)
//   }

//   // An unknown postal code is not an error — it is 200 with an empty array. Validity
//   // means "the array is non-empty", which is easy to get wrong.
//   const bogus = await call(`${GEOCODES}/zipcode/CO/000000`)
//   show('\nbogus postal code', `${bogus.status} -> ${JSON.stringify(bogus.payload)}`)

//   const usable = good.ok && Array.isArray(good.payload) && good.payload.length > 0
//   report(
//     'validateFulfillmentData',
//     usable ? 'FITS' : 'PARTIAL',
//     usable
//       ? 'postal code -> DANE code + state, which the CO rate call requires; a genuine use for this method'
//       : `geocode lookup returned ${good.status}`,
//   )
// }

// /**
//  * calculatePrice() + canCalculate(): the load-bearing question. The interface hands us
//  * a CalculateShippingPriceContext and wants back a single { amount }. Envia needs one
//  * call per carrier and answers each with N service rates, so the shape mismatch — and
//  * the latency of the fan-out — is what to measure.
//  *
//  * Doubles as the audit of the docs table's CO carrier list.
//  */
// async function probeRates() {
//   heading('3. calculatePrice()  —  POST /ship/rate (one call per carrier, in parallel, per lane)')

//   const rateBody = (lane, carrier) => ({
//     origin: lane.origin,
//     destination: lane.destination,
//     packages: PACKAGES,
//     // type 1 = parcel. `carrier` is required: there is no quote-everything mode.
//     shipment: { type: 1, carrier },
//     settings: { currency: CURRENCY },
//   })

//   console.log('request body for one carrier:')
//   console.log(JSON.stringify(rateBody(LANES[0], 'coordinadora'), null, 2))

//   const coverage = new Map(CO_CARRIERS.map((carrier) => [carrier, {}]))
//   const byLane = new Map()

//   for (const lane of LANES) {
//     const fanOutStarted = Date.now()
//     const responses = await Promise.all(
//       CO_CARRIERS.map(async (carrier) => ({
//         carrier,
//         ...(await call(`${API}/ship/rate`, {
//           method: 'POST',
//           body: rateBody(lane, carrier),
//           timeoutMs: RATE_TIMEOUT_MS,
//         })),
//       })),
//     )
//     const fanOutElapsed = Date.now() - fanOutStarted

//     console.log(`\n--- ${lane.label} — ${CO_CARRIERS.length} carriers in ${fanOutElapsed}ms wall clock`)

//     const rates = []
//     for (const response of responses) {
//       const error = response.timedOut ? `timed out after ${RATE_TIMEOUT_MS}ms` : enviaError(response.payload)
//       const list = error ? [] : (response.payload?.data ?? [])
//       rates.push(...list)

//       const kind = classifyError(error)
//       coverage.get(response.carrier)[lane.label] = error
//         ? `${kind.padEnd(8)} ${error.slice(0, 38)}`
//         : `ok ${list.length}`
//       console.log(
//         `  ${response.carrier.padEnd(19)} ${String(response.elapsed).padStart(6)}ms  ` +
//           (error ? `ERR ${error.slice(0, 62)}` : `${list.length} rate(s)`),
//       )
//     }

//     console.log(`\n  ${rates.length} rates, sorted by price:`)
//     for (const rate of [...rates].sort((a, b) => a.totalPrice - b.totalPrice)) {
//       const eta = rate.deliveryDate?.date ?? rate.deliveryEstimate ?? '—'
//       console.log(
//         `    ${String(rate.carrier).padEnd(19)} ${String(rate.service).padEnd(20)} ` +
//           `${String(rate.totalPrice).padStart(8)} ${rate.currency ?? ''}  eta ${eta}`,
//       )
//     }

//     byLane.set(lane.label, { rates, fanOutElapsed })
//   }

//   // The docs table lists 11 CO carriers. This is the audit of that claim.
//   heading('3b. Carrier coverage audit — does the sandbox honour the docs table for CO?')
//   console.log(`${'carrier'.padEnd(19)} ${LANES.map((lane) => lane.label.padEnd(48)).join('')}`)
//   for (const [carrier, lanes] of coverage) {
//     console.log(`${carrier.padEnd(19)} ${LANES.map((lane) => String(lanes[lane.label] ?? '—').padEnd(48)).join('')}`)
//   }

//   const lanesOf = (carrier) => LANES.map((lane) => String(coverage.get(carrier)[lane.label]))
//   const quoting = CO_CARRIERS.filter((carrier) => lanesOf(carrier).some((cell) => cell.startsWith('ok')))
//   // A carrier that only ever failed with an outage is unproven, not unsupported.
//   const down = CO_CARRIERS.filter(
//     (carrier) => !quoting.includes(carrier) && lanesOf(carrier).every((cell) => cell.startsWith('outage')),
//   )
//   const never = CO_CARRIERS.filter((carrier) => !quoting.includes(carrier) && !down.includes(carrier))

//   console.log(`\nquoted on at least one lane: ${quoting.length}/${CO_CARRIERS.length} — ${quoting.join(', ')}`)
//   console.log(`carrier API down right now:  ${down.length}/${CO_CARRIERS.length} — ${down.join(', ') || 'none'}`)
//   console.log(`never quoted:                ${never.length}/${CO_CARRIERS.length} — ${never.join(', ') || 'none'}`)

//   report(
//     'n/a — carrier coverage',
//     never.length === 0 && down.length === 0 ? 'FITS' : 'PARTIAL',
//     `${quoting.length}/${CO_CARRIERS.length} documented CO carriers quote; ` +
//       `${never.join(', ') || 'none'} recognised but never returned a rate` +
//       (down.length ? `; ${down.join(', ')} was down (1300) during this run, so unproven` : ''),
//   )

//   const [first] = LANES
//   const { rates, fanOutElapsed } = byLane.get(first.label)
//   report(
//     'calculatePrice',
//     'PARTIAL',
//     `${rates.length} rates from ${CO_CARRIERS.length} calls (${fanOutElapsed}ms on the inter-city lane), but the ` +
//       'interface returns a single { amount } — carrier+service must arrive via optionData to pick one row',
//   )
//   report('canCalculate', 'FITS', 'true for every Envia option; rates are always live')

//   // calculatePrice returns { amount } only. Everything else Envia gives us — eta,
//   // service description, surcharge breakdown — has nowhere to go in the interface.
//   const cheapest = [...rates].sort((a, b) => a.totalPrice - b.totalPrice)[0]
//   if (cheapest) {
//     show('\nfull cheapest rate', cheapest)
//     show(
//       '\nfields the current interface has no home for',
//       Object.keys(cheapest).filter(
//         (key) => !['totalPrice', 'carrier', 'service'].includes(key) && cheapest[key] !== null,
//       ),
//     )
//   }

//   return { lane: first, rates }
// }

// /**
//  * createFulfillment(): the interface passes items + a data blob and expects { data }
//  * back. Envia's generate call returns tracking number, label PDF and track URL, all of
//  * which fit inside that opaque blob.
//  */
// async function probeGenerateLabel({ lane, rates }) {
//   heading('4. createFulfillment()  —  POST /ship/generate')

//   if (!GENERATE_LABEL) {
//     console.log('skipped — rerun with --generate to buy a sandbox label')
//     report('createFulfillment', 'UNTESTED', 'rerun with --generate')
//     report('cancelFulfillment', 'UNTESTED', 'rerun with --generate')
//     return
//   }

//   const cheapest = [...rates].sort((a, b) => a.totalPrice - b.totalPrice)[0]
//   if (!cheapest) {
//     report('createFulfillment', 'BLOCKED', 'no rate to buy')
//     return
//   }

//   console.log(`buying: ${cheapest.carrier} / ${cheapest.service} @ ${cheapest.totalPrice} ${cheapest.currency}`)

//   const label = await call(`${API}/ship/generate`, {
//     method: 'POST',
//     body: {
//       origin: lane.origin,
//       destination: lane.destination,
//       packages: PACKAGES,
//       // The rate response carrier is display-cased ("interRapidisimo"); it round-trips
//       // back into generate as-is, so no re-slugging is needed.
//       shipment: { type: 1, carrier: cheapest.carrier, service: cheapest.service },
//       settings: { printFormat: 'PDF', printSize: 'STOCK_4X6', currency: CURRENCY },
//     },
//   })
//   show('status', `${label.status} in ${label.elapsed}ms`)
//   show('payload', label.payload)

//   const error = enviaError(label.payload)
//   if (!label.ok || error) {
//     report('createFulfillment', 'BLOCKED', `generate failed: ${error ?? label.status}`)
//     return
//   }

//   const [shipment] = label.payload.data ?? []
//   if (!shipment) {
//     report('createFulfillment', 'BLOCKED', 'generate returned no shipment')
//     return
//   }

//   report('createFulfillment', 'FITS', 'trackingNumber + label PDF + trackUrl all fit in the opaque { data } blob')

//   // The quote and the charge need not share a currency: the rate is denominated in
//   // settings.currency, but the account is debited in its own billing currency.
//   if (shipment.currency !== cheapest.currency) {
//     report('n/a — currency', 'GAP', `quoted in ${cheapest.currency}, account debited in ${shipment.currency}`)
//   }

//   // Handed back so main can track it before cancelling — cancel ends the shipment.
//   return shipment
// }

// /** cancelFulfillment(): returns void, so we only need the call to succeed. */
// async function probeCancel(shipment) {
//   heading('6. cancelFulfillment()  —  POST /ship/cancel')

//   const cancelled = await call(`${API}/ship/cancel`, {
//     method: 'POST',
//     body: { carrier: shipment.carrier, trackingNumber: shipment.trackingNumber },
//   })
//   show('status', `${cancelled.status} in ${cancelled.elapsed}ms`)
//   show('payload', cancelled.payload)

//   const error = enviaError(cancelled.payload)
//   report(
//     'cancelFulfillment',
//     error ? 'PARTIAL' : 'FITS',
//     error
//       ? `cancel refused (${error}) — carrier-dependent, and the void return gives us no way to report it`
//       : 'cancel by carrier + trackingNumber, both of which we stored in the data blob; balance refunded',
//   )
// }

// /**
//  * Tracking. No interface method covers this — IFulfillmentProvider ends at cancel — so
//  * this probe answers two product questions instead:
//  *
//  *   1. can we drive order state (shipped / out for delivery / delivered) from Envia?
//  *   2. is there anything to put on a map?
//  *
//  * Beware `/ship/track`: it exists, but it is a broken legacy route that throws raw PHP
//  * errors ("Undefined property: stdClass::$service", then "$locale") rather than
//  * validating its input. `/ship/generaltrack/` is the documented one.
//  */
// async function probeTracking(shipment) {
//   heading('5. (no interface method) — tracking  —  POST /ship/generaltrack/')

//   if (!shipment) {
//     console.log('skipped — needs a label; rerun with --generate')
//     report('n/a — tracking', 'UNTESTED', 'rerun with --generate')
//     return
//   }

//   const tracked = await call(`${API}/ship/generaltrack/`, {
//     method: 'POST',
//     body: { trackingNumbers: [shipment.trackingNumber] },
//   })
//   show('status', `${tracked.status} in ${tracked.elapsed}ms`)

//   const [record] = tracked.payload?.data ?? []
//   if (!record) {
//     show('payload', tracked.payload)
//     report('n/a — tracking', 'BLOCKED', 'generaltrack returned no record')
//     return
//   }

//   show('the fields that would drive order state', {
//     status: record.status,
//     estimatedDelivery: record.estimatedDelivery,
//     pickupDate: record.pickupDate,
//     shippedAt: record.shippedAt,
//     deliveredAt: record.deliveredAt,
//     signedBy: record.signedBy,
//     podFile: record.podFile, // proof of delivery, once delivered
//     trackUrl: record.trackUrl,
//     trackUrlSite: record.trackUrlSite, // the carrier's own tracking page
//     eventHistory: record.eventHistory,
//   })

//   // A sandbox label never gets scanned by the carrier, so the event feed stays empty —
//   // the shape of an individual event is the one thing this probe cannot show.
//   if ((record.eventHistory ?? []).length === 0) {
//     console.log('\neventHistory is empty: sandbox shipments are never scanned by the carrier.')
//   }

//   // The map question, answered against the response rather than the docs: walk every
//   // key in the payload and look for anything geographic.
//   const keys = new Set()
//   const walk = (node, path = '') => {
//     if (Array.isArray(node)) return node.forEach((child) => walk(child, `${path}[]`))
//     if (node && typeof node === 'object') {
//       for (const [key, value] of Object.entries(node)) {
//         const next = path ? `${path}.${key}` : key
//         keys.add(next)
//         walk(value, next)
//       }
//     }
//   }
//   walk(tracked.payload)

//   // "translation_tag" contains "lat", so match on whole words rather than substrings.
//   const geo = [...keys].filter((key) =>
//     /(^|[._[])(lat|latitude|lng|lon|longitude|coordinates|geo|position|gps)([._[]|$)/i.test(key),
//   )
//   console.log(
//     `\n${keys.size} fields in the tracking response; geographic ones: ${geo.length ? geo.join(', ') : 'NONE'}`,
//   )

//   report(
//     'n/a — order state',
//     'FITS',
//     `status + timestamps + proof-of-delivery are all there (28 documented statuses); ` +
//       'enough to drive order state, but no interface method owns it',
//   )
//   report(
//     'n/a — live map',
//     'GAP',
//     `no geographic field anywhere in the ${keys.size}-field tracking response — Envia relays discrete ` +
//       'carrier scan events, not GPS; only branches and geocoded postal codes can go on a map',
//   )
// }

// /**
//  * Webhooks. The push alternative to polling generaltrack, and the only way to learn a
//  * parcel moved without asking. Registration lives on the Queries API, which is where
//  * this falls down in sandbox.
//  */
// async function probeWebhooks() {
//   heading('7. (no interface method) — webhooks')

//   // Public endpoint: it answers without a token at all, which is why it works here
//   // when nothing else on the Queries API does.
//   const types = await call(`${QUERIES}/webhook-types`)
//   show('GET /webhook-types', `${types.status} in ${types.elapsed}ms`)

//   for (const type of types.payload?.data ?? []) {
//     console.log(`\n  ${type.id}  ${type.name} — ${type.description}`)
//     if (type.test_response) console.log(`     sample: ${type.test_response}`)
//   }

//   // Every webhook example in the docs points at queries-test.envia.com. It does not
//   // exist — the host answers with Heroku's "No such app" page.
//   const sandboxHost = await call('https://queries-test.envia.com/webhook-types')
//   const noSuchApp = typeof sandboxHost.payload?.raw === 'string' && sandboxHost.payload.raw.includes('No such app')
//   console.log(
//     `\nqueries-test.envia.com (the host the docs use): ${noSuchApp ? 'does not exist ("No such app")' : sandboxHost.status}`,
//   )

//   // Registration itself needs an authenticated Queries call, which the sandbox token
//   // cannot make against the production host.
//   const registered = await call(`${QUERIES}/webhooks`)
//   show('GET /webhooks (registration surface)', `${registered.status} — ${JSON.stringify(registered.payload)}`)

//   report(
//     'n/a — webhooks',
//     'PARTIAL',
//     `${(types.payload?.data ?? []).length} event types exist (3-5 HMAC-signed), but there is no sandbox ` +
//       'Queries host and the prod one 401s this token — registration is untestable without a production token',
//   )
//   report(
//     'n/a — inbound events',
//     'GAP',
//     'IFulfillmentProvider has no hook for inbound events; payloads carry only a status string, ' +
//       'so a webhook is a trigger to call generaltrack, not the data itself',
//   )
// }

// // -- Main --

// async function main() {
//   console.log(`Envia sandbox probe (Colombia) — token ${TOKEN.slice(0, 8)}…${TOKEN.slice(-4)}`)
//   console.log(`api ${API} | queries ${QUERIES} | geocodes ${GEOCODES}`)

//   await probeCarrierCatalogue()
//   await probeAddressValidation()
//   const quoted = await probeRates()

//   // Order matters: track the shipment before cancelling it.
//   const shipment = await probeGenerateLabel(quoted)
//   await probeTracking(shipment)
//   if (shipment) await probeCancel(shipment)

//   await probeWebhooks()

//   heading('FIT REPORT — IFulfillmentProvider')
//   for (const { method, verdict, note } of findings) {
//     console.log(`${verdict.padEnd(9)} ${method.padEnd(24)} ${note}`)
//   }
//   console.log()
// }

// main().catch((error) => {
//   console.error(error)
//   process.exit(1)
// })
