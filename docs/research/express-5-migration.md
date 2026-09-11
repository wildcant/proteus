# Express 4 → 5 in `apps/backend`, and What It Actually Breaks

Research findings on migrating this repo's Node platform adapter from `express@4.22.2` to
`express@5.2.1` — the change that closes the last two advisories `npm audit` reports which nothing
in-range can close. The question the ticket needs answered is not "is Express 5 different" but "does
*this* code touch any of the differences", and the answer turns out to be almost entirely no.

**Date:** 2026-09-11
**Verification method:** Express **5.2.1 and 4.22.2 were both installed and run** in the scratchpad,
with this repo's real route table, its real `createExpressApp` shape, `swagger-ui-express@5.0.1`,
`@bull-board/express@6.21.3`, `supertest@7` and `zod@4.6.2` — every behavioural claim below marked
*measured* is a program that ran, on both majors, and the two outputs compared. All **99 route
matchers were extracted from `apps/backend/src/api/**/definitions.ts` and registered against a real
Express 5 router**, then each was driven with a concrete request (§2.1). Dependency resolution was
done with `npm install --package-lock-only` against **copies** of this repo's nine manifests in the
scratchpad; nothing was installed into the working tree, and the only command run in the repo itself
was read-only `npm audit` and `npm run --workspace=backend typecheck`. **One caveat on the audit
numbers:** the working tree at the time already carried an in-progress, uncommitted
`drizzle-orm ^0.39.0 → ^0.45.2` bump in `apps/backend/package.json` and `package-lock.json` (ticket 03's subject), so the baseline measured here is **6** advisories rather than the number ticket 02
signed off on — `drizzle-orm`'s own high-severity entry is already gone. Nothing about that touches
`express` or `qs`, and the scratchpad clones were taken from the same manifests, so the before/after
comparison in §5 is like-for-like. Express's own behaviour is
cited to the migration guide's Markdown source in `expressjs/expressjs.com`, to the `path-to-regexp`
README, and to the installed `express@5.2.1` source in `node_modules` — so every quotation has a file
path or URL behind it. **The backend test suite was not run** (the test database was being restarted);
§6 is reasoning over the test files and is labelled unverified where it is.
**One-line answer:** **this is a one-line migration plus one two-line hardening**, because every one
of this repo's 99 route matchers is built from literal segments and `:name` parameters only — no `*`,
no `?`, no regex, no reserved character — which is exactly the subset `path-to-regexp` 8 left
unchanged; all 99 resolve **identically on Express 4 and Express 5** (measured), the custom
`query parser` function, the `express.json({ verify })` raw-bytes capture, the `express.static` mount
and the `app.use()` 404 catch-all all survive verbatim (measured), and `@types/express@5.0.6` is
**already installed and already passing `tsc --noEmit`** — the compiler has been checking this code
against the Express 5 API for some time.
**The one thing that genuinely changes:** `app.listen`. In Express 5 a bind failure is delivered *to
the callback* instead of thrown, and `src/start.ts`'s callback ignores its arguments — so an
`EADDRINUSE` that crashes the process today would instead resolve `start()` with a server that never
bound (measured, both majors, §2.7).
**And one thing the brief gets wrong:** bumping `express` is necessary but **not sufficient** to clear
the `qs` advisory. npm preserves an in-range lockfile entry, so `express@5`'s `"qs": "^6.14.0"` is
happy to keep the vulnerable `6.15.3` already pinned at the root. The ticket must pair the bump with
`npm update qs` (measured — §5.2).

---

## Table of Contents

1. [The Express surface, corrected](#1-the-express-surface-corrected)
2. [The breaking changes, one by one, against these files](#2-the-breaking-changes-one-by-one-against-these-files)
3. [The ecosystem packages](#3-the-ecosystem-packages)
4. [`@types/express` is already on 5](#4-typesexpress-is-already-on-5)
5. [What the migration does to `npm audit`](#5-what-the-migration-does-to-npm-audit)
6. [The test surface that would catch a regression](#6-the-test-surface-that-would-catch-a-regression)
7. [The whole diff](#7-the-whole-diff)
8. [Risks and unknowns, ranked](#8-risks-and-unknowns-ranked)
9. [Sequencing against tickets 03–08](#9-sequencing-against-tickets-0308)

---

## 1. The Express surface, corrected

The brief's inventory is accurate. Two additions and two corrections.

**Every file in the repo that names Express**, from
`grep -rn "from 'express'\|require('express')\|swagger-ui-express\|@bull-board/express"` over `*.ts`,
`*.tsx`, `*.json`, excluding `node_modules` — *measured 2026-09-11*:

| File | What it uses |
|---|---|
| [`apps/backend/src/framework/runtime/express/app.ts`](../../apps/backend/src/framework/runtime/express/app.ts) | `import express from 'express'` — the only runtime import of the package |
| [`apps/backend/src/start.ts`](../../apps/backend/src/start.ts) | `import type { RequestHandler } from 'express'`; `swagger-ui-express`; `expressApp.listen()` |
| [`apps/backend/src/framework/scheduler/bullmq/bullmq-cron-scheduler.ts`](../../apps/backend/src/framework/scheduler/bullmq/bullmq-cron-scheduler.ts) | `ExpressAdapter` from `@bull-board/express`, in `mountMonitor()` |
| [`apps/backend/tests/setup/create-api.ts`](../../apps/backend/tests/setup/create-api.ts) | `import type { Express } from 'express'`, `createServer(app)`, `supertest` |
| `apps/backend/package.json` | the three declarations |

That is it. Four source files, one of which imports only a type.

**Correction 1 — there is no file-based route discovery producing matchers.** The brief says
`route.matcher` is "a path string produced by this repo's own file-based route discovery". It is not:
every matcher is a **hand-written string literal in one of 29 `definitions.ts` files**, and
[`src/routes.ts`](../../apps/backend/src/routes.ts) imports them explicitly, by name, and
concatenates them. `prepareRoutes` sorts the result with `RoutesSorter` and copies `definition.matcher`
straight through:

```ts
return sorted.map((definition) => {
  logger.debug(`  ${definition.method} ${definition.matcher}`)
  return { method: definition.method, matcher: definition.matcher, handler: applyMiddleware(definition) }
})
```
— `apps/backend/src/routes.ts`. The `[id]` / `[provider]` bracket syntax in the *directory* names is a
naming convention for humans; nothing reads it. The type is
[`matcher: string`](../../apps/backend/src/framework/http/types.ts) — never a `RegExp`.

This matters enormously for §2.1, and in the good direction: the path shapes are a **closed,
enumerable set of 99 literals** rather than something generated, so "are any now invalid" is a
question that can be answered exhaustively rather than argued about.

**Correction 2 — `RoutesSorter` accepts a `RegExp` but nothing ever gives it one.**
`apps/backend/src/framework/http/routes-sorter.ts` declares `matcher: string | RegExp` and has
`wildcard` and `regex` buckets. Those branches are dead code with respect to Express: `RouteDefinition`
narrows the field back to `string`, and none of the 99 values contains a regex character. Worth
knowing, because a reader skimming the sorter would reasonably conclude this repo has wildcard routes.

**Addition — the Express adapter is the Node path only.** `src/index.ts` → `start()` →
`createExpressApp`. The workerd deployment goes through `src/index.workerd.ts` and
`src/framework/runtime/hono/app.ts`, which never touches Express. So the blast radius of this change is
`npm run dev`, the backend test suite, the e2e suites, and any Node deployment — not the Cloudflare
one.

---

## 2. The breaking changes, one by one, against these files

Every subsection names a change from the migration guide, then says what this repo does about it.
The guide's own framing is worth keeping in view:

> Express 5 is not very different from Express 4; although it maintains the same basic API, there are
> still changes that break compatibility with the previous version.
> — <https://github.com/expressjs/expressjs.com/blob/main/src/content/pages/en/guide/migrating-5.mdx>,
> *verified 2026-09-11*

### 2.1 Path route matching syntax — **the headline, and it is a non-event**

This is the change that breaks most Express 4 apps, and the one the brief correctly identifies as the
highest-value question. The guide lists five sub-changes:

> - The wildcard `*` must have a name, matching the behavior of parameters `:`, use `/*splat` instead of `/*`
> - The optional character `?` is no longer supported, use braces instead.
> - Regexp characters are not supported.
> - Some characters have been reserved to avoid confusion during upgrade (`()[]?+!`), use `\` to escape them.
> - Parameter names now support valid JavaScript identifiers, or quoted like `:"this"`.
> — the migration guide, *§Path route matching syntax*

`path-to-regexp` says the same in its own words:

> Path-To-RegExp breaks compatibility with Express <= `4.x` in the following ways: The wildcard `*`
> must have a name and matches the behavior of parameters `:`. The optional character `?` is no longer
> supported, use braces instead: `/:file{.:ext}`. Regexp characters are not supported. Some characters
> have been reserved to avoid confusion during upgrade (`()[]?+!`). Parameter names now support valid
> JavaScript identifiers, or quoted like `:"this"`.
> — <https://github.com/pillarjs/path-to-regexp/blob/master/Readme.md>, *verified 2026-09-11*

**None of the five applies here.** All 99 matchers were extracted from the `definitions.ts` files and
checked mechanically. *Measured 2026-09-11:*

```
matchers: 99
containing a path-to-regexp v8 reserved char ()[]?+!*{}"\ : 0  []
distinct param names: ['actorType', 'authProvider', 'code', 'fulfillmentId', 'id', 'imageId',
                       'lineId', 'provider', 'sessionId', 'variantId', 'zoneId']
all param names are valid JS identifiers: True
matchers not of the form (/:?[A-Za-z0-9_-]+)+ : []
```

Every matcher is built from exactly two token kinds: a literal segment, and `:name` where `name` is a
plain camelCase identifier. The most complex shapes in the whole table are

```
/admin/products/:id/variants/:variantId/images/batch
/admin/fulfillment-sets/:id/service-zones/:zoneId/geo-zones
/store/payment-collections/:id/payment-sessions/:sessionId
/auth/:actorType/:authProvider/reset-password
```

— four literal-and-parameter paths, which `path-to-regexp` 8 parses exactly as `path-to-regexp` 0.1
did. There are **no optional parameters, no catch-alls, no regex-in-path, and no unnamed wildcard**
anywhere in the API.

That is the static argument. The dynamic one was run. All 99 matchers were registered on a real
Express 5.2.1 router for all five verbs, then each was driven with a concrete URL and the response
checked to name the matcher that claimed it:

```
express 5.2.1 | registrations attempted 495 | ok 495 | failed 0
concrete requests matched to the right matcher: 99 / 99
express 4.22.2 | registrations attempted 495 | ok 495 | failed 0
concrete requests matched to the right matcher: 99 / 99
```
*Measured 2026-09-11 — `scratchpad/e5/allmatchers.cjs`, run against both installed majors.* Not one
registration threw, and every request landed on the same route on both majors.

**One thing that run did establish, by failing first.** On the initial pass — matchers registered in
sorted order rather than the order `prepareRoutes` produces — **8 of 99 went to the wrong route** on
*both* majors:

```
MISS /admin/invites/accept            -> matched /admin/invites/:id            {id: 'accept'}
MISS /admin/users/me                  -> matched /admin/users/:id              {id: 'me'}
MISS /admin/uploads/presigned-urls    -> matched /admin/uploads/:id            {id: 'presigned-urls'}
MISS /admin/payments/payment-providers-> matched /admin/payments/:id           {id: 'payment-providers'}
MISS /admin/products/:id/variants/batch -> matched /admin/products/:id/variants/:variantId
MISS /auth/token/refresh              -> matched /auth/:actorType/:authProvider
MISS /auth/verification/confirm       -> matched /auth/:actorType/:authProvider
MISS /auth/verification/request       -> matched /auth/:actorType/:authProvider
```

Re-registering with static-final segments before parameter-final ones — the rule
`RoutesSorter.orderBy = ['global', 'wildcard', 'regex', 'static', 'params']` encodes — gives 99/99 on
both. So: **`RoutesSorter` is load-bearing, for eight real routes**, and it is *application code*
that Express 5 does not touch. Nothing to change; something to not accidentally break. If the
migration branch ever reorders route registration for an unrelated reason, `/admin/users/me` is the
canary.

### 2.2 `app.set('query parser', fn)` — still a function, still handed a raw string

The repo's line is `app.set('query parser', (str: string) => qs.parse(str))`, and it is what keeps
Express's own bundled `qs` off the request path. It survives untouched, from source:

```js
exports.compileQueryParser = function compileQueryParser(val) {
  var fn;
  if (typeof val === 'function') {
    return val;
  }
  switch (val) {
    case true:
    case 'simple':   fn = querystring.parse; break;
    case false:      break;
    case 'extended': fn = parseExtendedQueryString; break;
    default: throw new TypeError('unknown value for query parser function: ' + val);
  }
  return fn;
}
```
— `node_modules/express/lib/utils.js`, express 5.2.1 (*read 2026-09-11*). A function is returned
verbatim, and `req.query`'s getter calls it with the raw query string:

```js
defineGetter(req, 'query', function query(){
  var queryparse = this.app.get('query parser fn');
  if (!queryparse) return Object.create(null);
  var querystring = parse(this).query;
  return queryparse(querystring);
});
```
— `node_modules/express/lib/request.js`, express 5.2.1.

*Measured:* the parser was instrumented and asked what it received for
`?filters[id][$in][]=a&filters[id][$in][]=b&offset=10`. On Express 5 it got
`typeof === 'string'`, value `filters[id][$in][]=a&filters[id][$in][]=b&offset=10`, and the handler
saw `{ filters: { id: { $in: ['a','b'] } }, offset: '10' }` — the nested-operator shape `AGENTS.md`
documents for every admin list endpoint.

**What did change, and why it does not reach us.** The default moved:

> The `req.query` property is no longer a writable property and is instead a getter. The default query
> parser has been changed from "extended" to "simple".
> — the migration guide, *§req.query*

Confirmed in source — `this.set('query parser', 'simple')` at `lib/application.js:97` on 5.2.1 versus
`this.set('query parser', 'extended')` at `lib/application.js:84` on 4.22.2 (*read 2026-09-11*), and
measured end-to-end: with the custom parser removed, Express 5 returns the flat
`{'filters[a][$in][]': 'x', b: '2'}` while Express 4 returns the nested object. **The custom parser is
therefore not a nicety — it is the only thing standing between this API and a silent, total loss of
nested query parsing on Express 5.** It is present today and stays. Worth a comment in the ticket so
nobody "simplifies" it away.

Nothing writes to `req.query`; `applyMiddleware` builds a new object
(`req = { ...req, validatedQuery: … }`), so the getter-not-writable change is inert.

### 2.3 `express.json()`'s `verify` — unchanged, and the raw-bytes WeakMap works

The webhook signature path depends on this. `express@5.2.1` depends on `body-parser@^2.2.1`, and
body-parser 2.3.0's README is word-for-word identical to 1.x's on this option:

> The `verify` option, if supplied, is called as `verify(req, res, buf, encoding)`, where `buf` is a
> `Buffer` of the raw request body and `encoding` is the encoding of the request. The parsing can be
> aborted by throwing an error.
> — `node_modules/body-parser/README.md` (2.3.0), *read 2026-09-11*; the call site is
> `lib/read.js:141–145`.

*Measured:* the repo's exact `verify` + `WeakMap<express.Request, Uint8Array>` construction, driven
with a payload chosen so re-serialisation would not reproduce it (`'{"a"  :  1}'`, extra whitespace):

```
raw-body: 200 { raw: '{"a"  :  1}', body: { a: 1 } }
```

The transmitted bytes arrive intact alongside the parsed object, on Express 5. `type: 'application/json'`
as an exact string still matches under `type-is@2`.

One addition to know about, from the guide's *Improvements* section:

> Middleware like `express.json()`, `express.urlencoded()`, `express.text()`, and `express.raw()` now
> support Brotli (`Content-Encoding: br`) decompression for incoming request bodies, in addition to
> `gzip` and `deflate`.

`verify` receives the **decompressed** buffer, which is already true of `gzip` on Express 4 — so this
widens the set of requests for which `rawBody` is the decompressed rather than the transmitted bytes.
No payment provider this repo integrates compresses its webhooks, so this is a note, not a finding.
**Unverified**: no compressed-webhook test was run.

### 2.4 Rejected promises — Express 5 forwards them; this repo never produces one

> Request middleware and handlers that return rejected promises are now handled by forwarding the
> rejected value as an `Error` to the error handling middleware.
> — the migration guide, *§Rejected promises handled from middleware and handlers*

The repo's handler is an `async` function whose body is entirely inside `try { … } catch (error) { const { status, json } = errorHandler(error, logger); res.status(status).json(json) }`. It cannot reject:
the `catch` is the last statement, and `errorHandler` is synchronous.

*Measured, on Express 5:* a handler with the repo's try/catch shape answered **422** with its own body
and the error handler was never reached; a deliberately un-caught `async` handler alongside it
answered **500** through the error-handling middleware, with `errorHandler:boom-unhandled` logged
there. Both behaviours are as documented.

So the change is a **pure improvement with zero migration cost here**: the existing behaviour is
unchanged, and the class of bug it fixes (an `async` handler throwing outside a `try`, which on
Express 4 hangs the request until the client times out) becomes a 500 instead. It is arguably worth
adding a terminal error-handling middleware in `start.ts` to convert those into this repo's own error
envelope — but that is an improvement, not a requirement, and it should be its own decision.

### 2.5 `req.body` is `undefined` instead of `{}` — real, and it does not reach a handler

> The `req.body` property returns `undefined` when the body has not been parsed. In Express 4, it
> returns `{}` by default.
> — the migration guide, *§req.body*

*Measured, both majors:*

| Request | Express 4 `req.body` | Express 5 `req.body` |
|---|---|---|
| `GET`, no `Content-Type` | `{}` | **`undefined`** |
| `DELETE`, no `Content-Type` | `{}` | **`undefined`** |
| `POST`, no `Content-Type`, body `hi` | `{}` | **`undefined`** |
| `POST`, `Content-Type: application/json`, body `''` | `{}` | `{}` |
| `POST/PUT/PATCH`, `Content-Type: application/json`, valid JSON | parsed | parsed |

Three reasons this does not bite:

1. **`applyMiddleware` only parses a body for `POST`/`PUT`/`PATCH` that declare one.** The guard is
   `if ((definition.method === 'POST' || 'PUT' || 'PATCH') && definition.input?.body)`
   ([`apply-middleware.ts`](../../apps/backend/src/framework/http/apply-middleware.ts)). A `GET` or
   `DELETE` handler never reads `req.body`, so `undefined` versus `{}` is unobservable.
2. **Of 67 mutating `*Input` consts under `src/api`, 54 declare a `body` schema and 13 do not**
   (*measured, parsing `export const (Post|Put|Patch)Input = { … }` in every `route.ts`*). The 13
   without one are action endpoints — `/admin/orders/:id/cancel`, `/store/carts/:id/complete`,
   `/admin/payments/:id/capture`, the webhook, and nine siblings — and none of their handlers reads
   `req.body`. `cancel/route.ts` is representative: `PostInput = { params: IdParams }`, and the handler
   is one line calling a workflow with `req.params.id`.
3. **The test harness is immune by construction.** `create-api.ts`'s verbs always
   `.set('Content-Type', 'application/json')`, which puts every mutating test call in the `{}` row
   above. *Measured with `supertest@7` against both majors:* `post`/`put`/`patch` with no body give
   `{}` on 4 **and** on 5; only `get` and `delete` differ, and those routes have no body schema.

**The one place the difference is real** is the browser clients, not the tests.
`apps/admin/src/api/fetcher.ts` sends neither a body nor a `Content-Type` when `data` is falsy:

```ts
} else if (data) {
  init.headers = { ...baseHeaders, 'Content-Type': 'application/json', ...headers }
  init.body = JSON.stringify(data)
} else {
  init.headers = { ...baseHeaders, ...headers }
}
```

So a `POST /admin/orders/:id/cancel` from the admin arrives with `req.body === undefined` on Express 5
and `{}` on Express 4. That route has no body schema and its handler never looks, so nothing changes.
The residual risk — a route that *does* declare a body schema where every field is optional, called
with no data — is enumerated in §8 as unverified: it would turn a 200 into a 400 with
`Invalid request body: expected object, received undefined`. No such call site was found, but the
search was over declared Orval operations rather than a running app.

**Note the direction of travel**: the Hono adapter already passes `body: undefined` for `GET`/`DELETE`
and for an unparseable body (`parseJsonBody` returns `undefined` on a `JSON.parse` throw). Express 5
makes the two runtimes agree where they diverge today.

### 2.6 `req.params` gets a null prototype — and Zod is fine with it

> The `req.params` object now has a **null prototype** when using string paths.
> — the migration guide, *§req.params*

This one deserved a check rather than a shrug, because `applyMiddleware` runs
`definition.input.params.safeParse(req.params)` and a schema validator is exactly the kind of code that
might reach for `Object.prototype`.

*Measured:* `z.object({ id: z.string(), zoneId: z.string() }).safeParse(req.params)` against
`GET /a/1/b/2` on express 5.2.1 with the repo's installed zod 4.6.2:

```
{"proto":"null-proto","ok":true,"err":null}
```

Accepted. The other two behavioural notes in that section — wildcard params becoming arrays, and
unmatched optional params being omitted — are unreachable, since there are no wildcards and no
optional params (§2.1).

### 2.7 `app.listen` — **the one thing that actually needs a code change**

> In Express 5, the `app.listen` method will invoke the user-provided callback function (if provided)
> when the server receives an error event. In Express 4, such errors would be thrown.
> — the migration guide, *§app.listen*

`src/start.ts` today:

```ts
const server = await new Promise<Server>((resolve) => {
  const onListening = () => resolve(httpServer)
  const httpServer = host ? expressApp.listen(port, host, onListening) : expressApp.listen(port, onListening)
})
```

The callback takes no parameters and there is no `reject`. *Measured — two apps, second binding a port
the first already holds:*

| | Result |
|---|---|
| express 4.22.2 | `uncaughtException: EADDRINUSE` — the process dies, loudly |
| express 5.2.1 | `listen callback arg: EADDRINUSE` — the callback fires with the error |

On Express 5 that callback would `resolve(httpServer)` with a server that never bound. `start()`
returns normally, `logger.info('Server ready on port 3000')` prints, the cron scheduler starts, and
nothing is listening. `@types/express@5`'s
`listen(port: number, callback?: (error?: Error) => void): http.Server` makes the parameter optional,
so **the compiler will not catch this** — a zero-argument callback is a valid one-optional-argument
callback.

This is a genuine regression in failure-mode quality and the one mandatory edit. The fix is to
`reject`:

```ts
const server = await new Promise<Server>((resolve, reject) => {
  const onListening = (error?: Error) => (error ? reject(error) : resolve(httpServer))
  const httpServer = host ? expressApp.listen(port, host, onListening) : expressApp.listen(port, onListening)
})
```

It is worth noting for the ticket that this matters most in the place it is least visible: each e2e
suite owns a port from `packages/testing/fixtures/e2e-config.ts`, and a port collision there is
currently a crash and would become a suite that starts, serves nothing, and fails with confusing
connection errors.

**Prove it bites.** The ticket should, after making the edit, start two backends on the same port and
confirm the second one fails rather than reporting ready — that is the mutation this change exists to
catch, and per `AGENTS.md` the ticket's reply should say it was run.

### 2.8 `express.static` — dotfiles now ignored; this repo has none

> The `express.static` middleware's `dotfiles` option now defaults to `"ignore"`. In Express 4,
> dotfiles were served by default. … The `dotfiles` check now also applies to hidden **directories**
> in the request path.
> — the migration guide, *§express.static dotfiles* and *§express.static() options*

The mount is `app.use('/static', express.static(path.join(process.cwd(), 'static')))` with no options,
so the `hidden`/`from` removals do not apply. The default change does — if anything under
`apps/backend/static/` began with a dot.

*Measured 2026-09-11:* `apps/backend/static/` holds **600 files, 0 of which start with `.`**. They are
all uploader output named `${timestamp}-${originalName}`, a shape that cannot produce a leading dot.
*Measured on Express 5:* `GET /static/hello.txt` → `200 static-ok`.

The other `static`-adjacent changes are inert: `express.static.mime` is never referenced, and the
`mime-db` MIME retyping (`.js` moving from `application/javascript` to `text/javascript`) affects only
`express.static()` and `res.sendFile()`, neither of which serves JavaScript here — the admin is a
separate Cloudflare Pages deployment.

### 2.9 The removals, and the rest of the *Changed* list

Checked against the guide's *Removed methods and properties* section and the remaining *Changed*
entries. **None of these appears anywhere in `apps/backend`** (*measured by grep, 2026-09-11*):

| Removed / changed | Used here? |
|---|---|
| `app.del()` | no |
| `app.param(fn)` / `router.param(fn)` / `router.param([names])` | no — `param` is never called |
| `req.acceptsCharset/Encoding/Language` (singular) | no |
| `req.param(name)` | no — the adapter reads `req.params`, `req.query`, `req.body` separately |
| `res.json(obj, status)`, `res.jsonp(obj, status)`, `res.send(body, status)`, `res.send(status)` | no — the only form used is `res.status(n).json(x)` |
| `res.redirect(url, status)`, `res.redirect('back')`, `res.location('back')` | no |
| `res.sendfile()` / `res.sendFile()` options | no |
| `express.static.mime` | no |
| `express.urlencoded` default `extended: false` | **not used at all** — only `express.json()` is mounted |
| `res.clearCookie` ignoring `maxAge`/`expires` | no — cookies are not set by the adapter |
| `res.vary()` with no argument | no |
| `res.status` restricted to 100–999 integers | safe — every value is a literal from a handler's `HttpResult` |
| `req.host` keeping the port | not read; the adapter uses `req.get('host')`, which was always unstripped |
| `express:router` debug namespace moving to `router` | only affects `DEBUG=` invocations; none committed |

The guide offers codemods (`npx codemod@latest @expressjs/v5-migration-recipe`). **Do not run them** —
every individual codemod targets something in the table above, so the recipe has nothing to do here
and would only risk touching unrelated code.

Two patterns the brief asked about specifically, both measured working on Express 5 and identical to
Express 4:

- **the `app.use()` catch-all 404** — `app.use((_req, res) => res.status(404).json({ error: 'Not Found' }))`
  → `GET /nope/nothing` returns `404 {"error":"Not Found"}`;
- **the CORS middleware + OPTIONS short-circuit** — `res.setHeader` in a path-less `app.use`, then
  `res.status(204).end()` → `OPTIONS /health` returns `204` with the header set.

---

## 3. The ecosystem packages

All three are fine, and one of them is already dragging Express 5 into this tree.

| Package | Installed | Express in its manifest | Verdict |
|---|---|---|---|
| `swagger-ui-express` | 5.0.1 | **no `peerDependencies` at all**; `express: ^4.19.2` in `devDependencies` only | works — measured |
| `@bull-board/express` | 6.21.3 | `"express": "^5.2.1"` as a **direct `dependencies` entry** | wants 5; today it gets its own private copy |
| `express-rate-limit` | 8.6.1 | `peerDependencies: { "express": ">= 4.11" }` | satisfied by both majors |

*All read from the installed `node_modules/*/package.json` in this tree, 2026-09-11.*

**`@bull-board/express` already pulls Express 5 into this tree — as does the MCP SDK.** Three copies of
Express are installed right now:

```
node_modules/express                                       @ 4.22.2
node_modules/@bull-board/express/node_modules/express      @ 5.2.1
node_modules/@modelcontextprotocol/sdk/node_modules/express @ 5.2.1
```
*Measured from the repo's own `package-lock.json`, 2026-09-11.*

That has a consequence worth putting in the ticket, because it reframes the risk: **the router mounted
at `/admin/queues` today is already an Express 5 router**, running inside an Express 4 application.
`scheduler.mountMonitor()` returns `ExpressAdapter#getRouter()`, built by `@bull-board/express`'s own
`express@5.2.1`, and `start.ts` mounts it with a `RequestHandler` cast. It works — Express 4 and 5
routers are both `(req, res, next)` functions — but it means the cross-major mount is the status quo,
and migrating *removes* it rather than introducing it.

*Measured on Express 5.2.1:* `swagger-ui-express@5.0.1` at `/admin/docs` and `@bull-board/express@6.21.3`
at `/admin/queues`, mounted exactly as `start.ts` mounts them —

| Path | Express 5 | Express 4 |
|---|---|---|
| `/admin/docs` | `301 → /admin/docs/` | `301 → /admin/docs/` |
| `/admin/docs/` | `200 text/html` | `200 text/html` |
| `/admin/docs/swagger-ui.css` | `200 text/css` | `200 text/css` |
| `/admin/queues` | `200 text/html` | *(4 dedupes to its own 5.x copy)* |
| `/admin/queues/` | `200 text/html` | — |

Identical. `swagger-ui-express` having no peer range at all means npm will not warn either way; that is
a small honesty gap in the ecosystem, not a problem for us, since it was measured rather than assumed.

`@types/swagger-ui-express@4.1.8` declares `"@types/express": "*"` and therefore already resolves to
`@types/express@5.0.6` — a version mismatch in the *name* only.

---

## 4. `@types/express` is already on 5

`apps/backend/package.json` declares `"@types/express": "^5.0.0"` in `devDependencies`, and the tree
has:

```
@types/express                    @ 5.0.6
@types/express-serve-static-core  @ 5.1.2
@types/body-parser                @ 1.19.6
@types/serve-static               @ 2.2.0
```
*Measured 2026-09-11.*

So yes — **the types are ahead of the runtime, and have been.** The compiler has been checking this
code against the Express 5 API surface while Express 4 executes it.

`npm run --workspace=backend typecheck` → **clean, exit 0** (*run 2026-09-11 in the repo; read-only*).

Three implications for the ticket, and they all point the same way:

1. **The type half of the migration is already done and already green.** There is nothing to bump in
   `devDependencies` — `^5.0.0` is correct today and correct after.
2. **A class of Express 4 idiom is already impossible to write here.** Anything the v5 types removed —
   `req.param()`, `res.send(body, status)` — would already be a compile error, which is a large part
   of why §2.9's table is empty.
3. **It also means `typecheck` will not move when the runtime does**, so it is *not* evidence for the
   migration. It is evidence that the migration has less to do than it looks, which is a different
   claim. The things that can still break are the runtime behaviours in §2, and the only one of those
   the compiler could have caught — the `app.listen` callback — it cannot, because the error parameter
   is optional (§2.7).

There is one small reason the current state is *worse* than either endpoint: today `tsc` types
`express.static` with a `dotfiles` default it does not have at runtime, and types `req.body` under a
v5 contract while v4 supplies `{}`. Nothing in this codebase depends on either, but "types from one
major, runtime from another" is a standing invitation, and closing it is a real if minor benefit of
the migration beyond the advisory.

---

## 5. What the migration does to `npm audit`

### 5.1 Where things stand today

`npm audit` in the repo, *measured 2026-09-11* (read-only; no install was run):

```
{"info":0,"low":0,"moderate":6,"high":0,"critical":0,"total":6}

@esbuild-kit/core-utils | moderate | *                                    | fix: drizzle-kit@0.18.1 (major, a DOWNGRADE)
@esbuild-kit/esm-loader | moderate | *                                    | fix: drizzle-kit@0.18.1
drizzle-kit             | moderate | 0.19.0 - 1.0.0-beta.1-fd8bfcc        | fix: drizzle-kit@0.18.1
esbuild                 | moderate | <=0.24.2                             | fix: drizzle-kit@0.18.1
express                 | moderate | 4.22.2            via: qs            | fix: true
qs                      | moderate | 2.2.5 - 6.15.3                       | fix: true
```

The `express` entry carries no advisory of its own — `via: ["qs"]` — it is attributed the child's.
The two `qs` advisories, from the GitHub Advisory API (*queried 2026-09-11*):

| GHSA | Published | Severity | Vulnerable | First patched |
|---|---|---|---|---|
| [GHSA-x5fp-wj9c-mxmx](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx) — *qs array-limit bypass via bracket-key comma parsing* | 2026-09-02 | medium | `>= 6.14.2, <= 6.15.3` | **6.16.0** |
| [GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) — *qs: Denial of Service via Attacker Controlled isBuffer* | 2026-09-02 | medium | `>= 2.2.5, < 6.16.0` | **6.16.0** |

**A correction to the brief's framing of why Express 4 cannot fix this.** The brief says 4.22.2 is
"the latest 4.x, with no further releases". The first half is right; the second is not. Express's own
support table says:

> | Major Version | Minimum Node.js Version | Support Start Date | Support End Date |
> | **v5.x** | 18 | September 2024 | **ongoing** |
> | **v4.x** | 0.10.0 | April 2014 | **ongoing** |
> — <https://github.com/expressjs/expressjs.com/blob/main/src/content/pages/en/support.mdx>,
> *verified 2026-09-11*

4.x is still supported, and 4.22.2 was published **2026-05-11** — five months *after* 5.2.1
(2025-12-01). `npm view express dist-tags` → `{"latest":"5.2.1","latest-4":"4.22.2"}` (*measured*).
The real reason is narrower and more certain: the `qs` advisories were published **2026-09-02**, nine
days ago and four months after the last 4.x release, so **there is no released 4.x whose `qs` range
reaches 6.16.0** — 4.22.2 declares `"qs": "~6.15.1"`, which caps at `6.15.x`. A future 4.x could widen
it. Nothing obliges anyone to ship one, and Express 5 needs nothing: it declares `"qs": "^6.14.0"`
(*read from `node_modules/@bull-board/express/node_modules/express/package.json`, 5.2.1*).

### 5.2 What the bump actually does — and the part the brief gets wrong

Resolved in the scratchpad against **copies** of this repo's nine manifests, with only
`apps/backend`'s `express` changed to `^5.2.1`. *Measured 2026-09-11:*

```
node_modules/express @ 5.2.1
node_modules/qs      @ 6.15.3     ← still vulnerable
```
```
meta {"moderate":5,"total":5}
@esbuild-kit/core-utils, @esbuild-kit/esm-loader, drizzle-kit, esbuild, qs
```

**The `express` advisory disappears; the `qs` one does not.** `npm` does not gratuitously upgrade a
lockfile entry that still satisfies every range, and `6.15.3` satisfies express 5's `^6.14.0`. Five
advisories, not four.

Adding `npm update qs` closes it:

```
node_modules/qs      @ 6.16.0
node_modules/express @ 5.2.1
meta {"moderate":4,"total":4}
@esbuild-kit/core-utils, @esbuild-kit/esm-loader, drizzle-kit, esbuild
```

**6 → 4, and the four survivors are ticket 03's drizzle-kit/esbuild chain in its entirety.** After
this ticket and ticket 03, `npm audit` on this tree is clean.

**The control, because the claim is that Express 5 is *necessary*:** the same manifests, `express` left
at `^4.21.0`, `npm update qs` run anyway —

```
root qs @ 6.15.3 | express @ 4.22.2
meta {"moderate":6,"total":6}
… express, qs
```

`npm update` cannot move it: express 4's `~6.15.1` is the ceiling and the root copy is the one it
needs. **Express 5 is load-bearing, and `npm update qs` alone is not enough.** Both are required, and
the ticket's acceptance criterion should be the audit count, not the `express` line in the manifest.

### 5.3 A second, unrelated win: three copies of Express become one

```
before   node_modules/express                                        @ 4.22.2
         node_modules/@bull-board/express/node_modules/express        @ 5.2.1
         node_modules/@modelcontextprotocol/sdk/node_modules/express  @ 5.2.1
         node_modules/qs @ 6.15.3  +  apps/backend/node_modules/qs @ 6.16.0
         +  apps/admin/node_modules/qs @ 6.16.0  +  body-parser/node_modules/qs @ 6.16.0

after    node_modules/express @ 5.2.1
         node_modules/qs      @ 6.16.0
```
*Measured — the repo's committed lockfile versus the scratchpad resolution.* Three Express copies
collapse to one, and **four** `qs` copies collapse to one. See §9 for what that does to ticket 05.

---

## 6. The test surface that would catch a regression

**Not run.** The backend suite was not executed — the test database was being restarted. Everything in
this section is read from the test files and is **unverified** except where a measurement from §2 is
cited.

### 6.1 How tests reach the Express adapter

Through one door: [`apps/backend/tests/setup/create-api.ts`](../../apps/backend/tests/setup/create-api.ts).
**29 files under `apps/backend/src` reference `createApi`** (*measured by grep, 2026-09-11*). It rebuilds what the real server builds —
`applyNamespaceAuth` → `RoutesSorter` → `applyMiddleware` → `createExpressApp` — binds it to
`127.0.0.1:0` through `node:http`'s `createServer`, and drives it with supertest. So every API test is
already an Express-adapter test; there is no mock HTTP layer to hide behind.

Two files test the adapter directly: `src/framework/runtime/__tests__/raw-body.test.ts` and
`multipart-files.test.ts`. `raw-body.test.ts` is the important one — it constructs `createExpressApp`
*and* `createHonoApp` over the same route and asserts both hand the handler the transmitted bytes, with
a guard test proving the payload is not re-serialisation-stable. **That test is the §2.3 `verify` /
WeakMap contract, written down.**

### 6.2 Does `test:gate` cover it?

`test:gate` is `vitest run src/api src/core/event-bus src/core/utils src/modules/payment src/framework/runtime`
(`apps/backend/package.json`), and it is `verify`'s `test` job (`scripts/verify.sh:127`). Two of those
five paths are exactly the Express surface: **all 26 `src/api/**/__tests__/*.api.test.ts` files, plus
both `src/framework/runtime/__tests__` files.** So `npm run verify` is the right gate for this change —
which is fortunate, because §5's real work is in a lockfile and would otherwise be unverified by
anything.

### 6.3 Would it catch a path-matching break? — yes for the shapes, partially for the routes

Approximately **57 of the 99 matchers are exercised by at least one path literal in a backend test**
(*measured by a heuristic that normalises `${…}` interpolations and matches segment-wise; approximate
in both directions — it may credit a matcher a helper file merely mentions, and it does not see paths
built by string concatenation*). The 42 unexercised include all of `/admin/fulfillment-sets/**`, all of
`/admin/product-options/**`, `/admin/orders/:id` and its five action routes, and
`/admin/refund-reasons`.

That sounds worse than it is, and the reason is §2.1. **The risk here is per *shape*, not per route,
and there are only two shapes.** Every one of the 99 matchers is literal segments plus `:name`. A
break in `path-to-regexp` 8 would break the class, not one member, and the class is covered many times
over — `/admin/products/:id/variants/:variantId/prices` and
`/store/payment-collections/:id/payment-sessions/:sessionId` are both exercised, and both are
four-segment two-parameter paths. The 99/99 registration-and-request run in §2.1 is the stronger
evidence anyway: it covers 100% of matchers, not 57%, and it was actually executed on both majors.

### 6.4 What `test:gate` would *not* catch

Worth stating plainly, because these are where §8's risks live:

- **The `app.listen` change (§2.7).** `create-api.ts` does not call `expressApp.listen()` at all — it
  wraps the app in `createServer(app)` and calls `server.listen(0, '127.0.0.1', …)` on the Node server.
  `start.ts`'s `listen` path is exercised by the **e2e** suites and by `npm run dev`, neither of which
  is in `verify`, and only on a port collision even then. **This is the single most likely thing to ship
  unnoticed.**
- **The `req.body` → `undefined` change from a real browser client (§2.5).** The harness always sets
  `Content-Type: application/json`, which is precisely the case where 4 and 5 agree. Only Playwright
  goes through `apps/admin/src/api/fetcher.ts`.
- **`swagger-ui-express` and `@bull-board/express` mounts.** Nothing under `src/api` touches
  `start.ts`; there is no test for `/admin/docs` or `/admin/queues`. Covered here by measurement
  (§3) rather than by the suite.
- **The lockfile result itself.** No gate in `verify` reads a lockfile. Ticket 08 is where that
  changes; until then the audit count is a manual check.

The honest summary: `test:gate` covers the routing and body-handling half comprehensively and the
process-lifecycle half not at all, and the ticket should compensate with (a) the deliberate
port-collision check of §2.7, and (b) one manual `npm run dev` plus a visit to `/admin/docs`,
`/admin/queues`, `/health` and one nested-query list endpoint.

---

## 7. The whole diff

Being honest about effort, as the brief asks: **this is small.** One manifest line is mandatory, one
`start.ts` edit is strongly recommended, and one lockfile command is required for the advisory to
actually close.

**1. `apps/backend/package.json`** — the only manifest change:

```diff
-    "express": "^4.21.0",
+    "express": "^5.2.1",
```

`@types/express` stays at `^5.0.0` (§4). `swagger-ui-express`, `@bull-board/express` and
`@types/swagger-ui-express` are all unchanged (§3).

**2. `apps/backend/src/start.ts`** — the `app.listen` error contract (§2.7):

```diff
-const server = await new Promise<Server>((resolve) => {
-  const onListening = () => resolve(httpServer)
+const server = await new Promise<Server>((resolve, reject) => {
+  // Express 5 delivers a bind failure to this callback instead of throwing it, so a port
+  // collision resolves `start()` with a server that never listened unless we reject here.
+  const onListening = (error?: Error) => (error ? reject(error) : resolve(httpServer))
   const httpServer = host ? expressApp.listen(port, host, onListening) : expressApp.listen(port, onListening)
 })
```

**3. The lockfile** — `npm install` for the bump, then `npm update qs`, because the bump alone leaves
`qs@6.15.3` at the root (§5.2). Acceptance is `npm audit` reporting **4**, not 6, with only the
`@esbuild-kit`/`esbuild`/`drizzle-kit` chain left.

**Nothing else.** `src/framework/runtime/express/app.ts` — the file the brief flags as the main
surface — needs **no change at all**: every construct in it was measured working identically on 5.2.1.
The two optional follow-ups, neither of which belongs in this ticket:

- a terminal error-handling middleware in `start.ts`, now that Express 5 forwards rejections (§2.4);
- a comment on `app.set('query parser', …)` recording that it is load-bearing for a reason that is new
  on Express 5 — the default is now `'simple'`, and removing the line silently flattens every nested
  operator param (§2.2). This is cheap and high-value; the ticket should include it.

---

## 8. Risks and unknowns, ranked

Ranked by expected cost, which is *probability × how long it takes to notice*. Everything not measured
is labelled.

1. **The `app.listen` silent-success on a bind failure — high impact, certain to occur eventually,
   invisible when it does.** *Measured.* Mitigated entirely by the three-line edit in §7. The reason it
   is first despite having a known fix is that it is the only change here that makes a failure
   *quieter*, and neither `typecheck` (the error parameter is optional) nor `test:gate` (`create-api.ts`
   does not use `app.listen`) can see it. If the ticket does one thing carefully, this is it.

2. **`req.body === undefined` on a route with an all-optional body schema called with no data —
   unverified.** *The mechanism is measured (§2.5); the absence of such a call site is not.* It would
   turn a working admin action into `400 Invalid request body: expected object, received undefined`.
   The search covered the 67 mutating `*Input` consts and the admin fetcher's `else if (data)` branch,
   and found no instance — but it did not run the admin against a live Express 5 backend. **The cheapest
   real check is the admin Playwright suite**, which the ticket should run once (`npm run --workspace=admin test:e2e`)
   rather than reason about.

3. **The 42 unexercised matchers — unverified by the suite, but measured by §2.1.** Every one was
   registered and driven successfully on Express 5. The residual is that §2.1 exercised *routing*, not
   the handlers behind those routes, so a change in how `req.params` reaches a handler (null prototype,
   §2.6) is proven only for the Zod path. It is the same code path for all 99, so this is close to
   theoretical.

4. **`verify` cannot see the thing this ticket is actually for.** No gate reads a lockfile, so
   "advisories went from 6 to 4" is a manual claim. It will stay manual until ticket 08 lands
   `npm run audit`. Write the before/after counts into the PR body.

5. **`swagger-ui-express@5.0.1` declares no Express peer range at all — measured, and it is the reason
   this is a risk rather than a non-issue.** It works on 5.2.1 (§3), but nothing in the dependency graph
   *asserts* that, so a future `swagger-ui-express` patch could regress it without npm warning. The
   `/admin/docs` and `/store/docs` mounts have no automated test. Consider a small `start.ts`-level
   test, or accept it as a dev-only surface.

6. **Brotli-encoded request bodies and `verify` — unverified.** Express 5 adds `br` to the set
   `express.json()` decompresses (§2.3), widening the set of requests where `rawBody` is decompressed
   rather than transmitted bytes. Irrelevant unless a payment provider starts compressing webhooks.
   Recorded so that if webhook signature verification ever fails mysteriously, this is on the list.

7. **The Express 5 codemods were not run and should not be — unverified by design.** The
   `@expressjs/v5-migration-recipe` targets `app.del`, `req.param`, pluralized `accepts*`,
   `static`/`sendFile` options and `static.mime`, none of which appear here (§2.9). Running it means
   accepting an automated edit across a codebase where its entire target set is empty.

8. **Node version — measured, and a non-issue.** Express 5 requires Node ≥ 18 (`engines` in its
   manifest, and *"you need to have a Node.js version 18 or higher"* in the migration guide). This
   machine runs v24.14.0. Note there is **no `.nvmrc` in this repo** (*measured — the file does not
   exist*), and no `engines` field in the root or backend `package.json`, so nothing pins the floor. A
   contributor on Node 16 has other problems already; this ticket does not create them, but it is a
   reason to add `engines` / `.nvmrc` sometime.

9. **`@types/swagger-ui-express@4.1.8` against `swagger-ui-express@5.0.1` — pre-existing, unchanged.**
   It resolves `@types/express: "*"` to 5.0.6, so it is already consistent with the target. Noted only
   so it is not mistaken for migration fallout.

**Not a risk, despite looking like one:** the cross-major router mount at `/admin/queues`. It is the
*status quo* — `@bull-board/express@6.21.3` depends on `express@^5.2.1` directly, and today mounts a
5.x router inside a 4.x app (§3). The migration removes the mismatch.

---

## 9. Sequencing against tickets 03–08

**Recommendation: this is its own ticket, it blocks nothing, nothing blocks it, and the best slot is
immediately — in parallel with 03, before 05 and 06.** Three reasons, in descending order of strength.

### 9.1 It makes ticket 05 smaller, and 05 has already written the entry it deletes

[`05-one-version-of-each-dependency.md`](../../.scratch/pnpm-migration/issues/05-one-version-of-each-dependency.md)
builds a duplicate-version gate with an `accepted` map "whose value is the reason", and its first entry
is:

```js
express: 'backend pins 4; @bull-board/express needs 5. Two majors, and only the backend imports express.',
```

That line exists only because of this ticket's subject, and the measurement in §5.3 deletes it: with
`express@^5.2.1`, the scratchpad resolution of this repo's nine manifests contains **exactly one
`node_modules/express`, at 5.2.1**, and the two nested copies vanish. One of 05's three "genuine
cross-major splits with no fix" turns out to have a fix, and it is this. **If this lands first, 04 is
written against a tree where it is already true.** If it lands second, 04 ships an `accepted` entry
that has to be deleted a week later — and an accepted-forever exception is precisely the kind of thing
that never gets revisited.

### 9.2 Ticket 06's fidelity argument wants the version churn finished first

[`06-the-migration.md`](../../.scratch/pnpm-migration/issues/06-the-migration.md) rests on a measured
result — *"Blockers fixed → `pnpm import` → then new declarations: 8 packages resolving differently"*
versus 180 for a fresh install — and `pnpm import` reproduces the npm lockfile's resolutions **only if
it runs against manifests whose specs have not changed**. Changing `express`'s spec *after* the import
means a `pnpm up` in the pnpm world; doing it before means it is simply part of the baseline the import
reproduces.

This is exactly the argument [ticket 02](../../.scratch/pnpm-migration/issues/02-in-range-security-bumps.md)
makes for itself — *"So that a regression is attributable. Ticket 06 changes where every package
resolves from; this one changes which versions they are. Run together, a broken test could be
either."* — and it applies here word for word. **Treat this as 02's postscript: the one bump 02 could
not take in range.**

### 9.3 It is independent of ticket 03, in the same way 03 is independent of 05

Ticket 03 edits repositories and models; this edits a platform adapter and a manifest line. Disjoint
files, disjoint failure modes. They can run as two branches at once. The only interaction is 03's own
stated one: whichever lands second regenerates the lockfile in that branch's format.

### 9.4 The order

| | |
|---|---|
| **Now, in parallel with 03** | **This ticket.** One manifest line, one `start.ts` edit, `npm update qs`. Acceptance: `npm audit` → 4, `npm run verify` green, plus the port-collision check (§2.7) and one `admin test:e2e` run (§8, risk 2). |
| Also now, independent of everything | Ticket 08 **step 1 only** — `gh api -X PUT repos/wildcant/proteus/vulnerability-alerts`. Opens no PRs, per `docs/research/dependabot.md` §7.2. |
| Then, in either order | Ticket 03 (drizzle). After both, `npm audit` on this tree is **clean**. |
| Then, interleaved | Tickets 05 + 06, with 05's `accepted` map **one entry shorter**. |
| After 06 | Ticket 07 (prose), then the rest of 08. |

### 9.5 If it slips

Nothing breaks. The two advisories are already accepted, they are moderate, and neither is reachable in
a way that matters more than the ones ticket 02 just closed — the `qs` array-limit bypass is reachable
from a query string on every admin list endpoint, but **this repo's request path does not use Express's
bundled `qs` at all**: `app.set('query parser', (str) => qs.parse(str))` routes every query through
`apps/backend/node_modules/qs`, which is **already 6.16.0** (*measured*). The vulnerable copy at the
root is reached by `express`'s own internals and by `superagent` in tests.

That is worth saying out loud, because it changes what this ticket is *for*: **the advisory is real but
largely already mitigated by an unrelated architectural choice, and the migration's actual value is
getting the runtime onto the major the types, the tooling and half the dependency tree are already on.**
It is a good ticket. It is not an urgent one.

---

## 10. Where the evidence is thin

- **The backend test suite was not run.** Every claim in §6 is read from source. The `raw-body.test.ts`
  contract is measured *equivalently* in §2.3 but not *through* that file.
- **No Playwright suite was run**, per the repo's working preferences. §8 risk 2 is the one place that
  matters, and the ticket should close it.
- **The matcher-coverage figure (57/99) is a heuristic**, approximate in both directions. It is offered
  as a shape, not a number to act on; §2.1's 99/99 is the load-bearing measurement.
- **`npm install` was never run in the repo tree.** All resolution results come from
  `--package-lock-only` against copies of the manifests in
  `/private/tmp/.../scratchpad/{e4,e5,repo4,repo5}`. A real install could in principle differ —
  optional dependencies, platform-specific packages — though not for anything in `express`'s subtree.
- **Express 5.2.1 is what was tested.** Express 5.3 or 5.4 may exist by the time the ticket runs; the
  `^5.2.1` range accepts them and none of the measurements here would necessarily carry over. Re-check
  §5.2's audit result against whatever resolves on the day.
