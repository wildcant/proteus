# 04 — Express 4 → 5, for the two advisories 02 could not reach

**What to build:** `apps/backend` runs on Express 5, the root `qs` is the fixed one, and the
`app.listen` failure mode that Express 5 quietly changes is closed rather than inherited.

**Blocked by:** nothing, and it blocks nothing. Best run **in parallel with 03, before 05 and 06** —
see *Where this sits*.

**Status:** planned.

**Spec:** `.scratch/pnpm-migration/spec.md`, P1c — F1. This is ticket 02's remainder: the one bump
that does not fit inside a declared range.

**Research:** `docs/research/express-5-migration.md` — every behavioural claim below was measured
against Express 5.2.1 and 4.22.2 side by side, or is labelled unverified there. Read §2.1, §2.7 and
§5.2 before starting.

---

## Why

Ticket 02 closed 18 of 23 advisories with in-range bumps and left two open: `express` and `qs`.
`express@4.22.2` is the latest 4.x and declares `"qs": "~6.15.1"`, which caps it below the fixed
`qs@6.16.0`. That vulnerable `qs@6.15.3` is the copy hoisted to the root of `node_modules`.
`express@5.2.1` declares `"qs": "^6.14.0"` and reaches 6.16.0 on its own. Express 5 is the only fix
that does not force a dependency past a range its maintainer wrote.

Express 4 is **not** EOL — support is ongoing and 4.22.2 shipped 2026-05-11. The two `qs` advisories
simply published on 2026-09-02, after the last 4.x release.

**Say the honest thing out loud, because it sets the urgency:** the `qs` array-limit bypass is
reachable from a query string on every admin list endpoint *in general*, but not here.
`src/framework/runtime/express/app.ts` does `app.set('query parser', (str) => qs.parse(str))`, which
routes every query through `apps/backend/node_modules/qs` — **already at 6.16.0** after ticket 02
(measured). The vulnerable root copy is reached only by Express's own internals and by `superagent`
in tests. This is a good ticket. It is not an urgent one, and if it slips nothing breaks.

Its real value is elsewhere: the runtime moves onto the major that the types, the tooling and half the
dependency tree are **already on**.

## What the research changed about the plan

Three corrections worth knowing before you start, because each one removes work the ticket looked like
it had.

**There is no file-based route discovery on this path.** All **99 route matchers are hand-written
string literals** across 29 `definitions.ts` files, and `RouteDefinition.matcher` is typed `string`,
never `RegExp`. Zero contain a path-to-regexp-8 reserved character; all 11 param names are valid JS
identifiers; there is no `*`, no `:param?`, no inline regex anywhere. All 99 were registered on real
Express 5.2.1 and 4.22.2 routers across all five verbs and driven with a concrete request each:
**99/99 identical on both majors**. The breaking change everyone fears here is a non-event (§2.1).

**`src/framework/runtime/express/app.ts` needs no change at all.** Measured working identically on
5.2.1: the custom `query parser` function still receives a raw string, `express.json({ verify })`
still fills the raw-bytes `WeakMap` that webhook signature verification depends on, `express.static`,
the `app.use()` 404 catch-all, the OPTIONS short-circuit and `res.status().json()` are all unchanged
(§2.2–§2.9).

**The bump alone does not close the advisory.** `express@^5.2.1` on its own leaves `qs@6.15.3` at the
root, because npm preserves an in-range lock entry and 6.15.3 satisfies `^6.14.0`. Pairing it with
`npm update qs` is what takes the count from 6 to 4 (§5.2). A control run confirms `npm update qs` on
Express 4 cannot move it.

---

## The work

Small, and deliberately so.

### 1. One manifest line

```diff
-    "express": "^4.21.0",
+    "express": "^5.2.1",
```

`@types/express` stays at `^5.0.0` — it is already resolving to 5.0.6 and `tsc --noEmit` passes today,
so the type half of this migration has been done for a while (§4). `swagger-ui-express`,
`@bull-board/express` and `@types/swagger-ui-express` are all unchanged (§3).

### 2. The `app.listen` error contract — the one mandatory code change

Express 4 throws a bind failure as an uncaughtException. Express 5 hands it to the `listen` callback.
`start.ts`'s callback takes no parameters and the promise has no `reject`, so on Express 5 an
`EADDRINUSE` would `resolve()` with a server that never bound: `start()` returns, *"Server ready on
port 3000"* prints, the cron scheduler starts, and nothing is listening.

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

This is the only change in the ticket that makes a failure *quieter*, and **neither gate can see it**:
`@types/express@5` types the error parameter optional, so a zero-argument callback still typechecks,
and `create-api.ts` never calls `app.listen`, so `test:gate` never reaches it.

It matters most where it is least visible. Each e2e suite owns a port from
`packages/testing/fixtures/e2e-config.ts`; a collision there is currently a crash and would become a
suite that starts, serves nothing, and fails with confusing connection errors.

### 3. A comment on the query parser, which is newly load-bearing

Express 5 changed its default query parser from `'extended'` to `'simple'`. That makes
`app.set('query parser', (str) => qs.parse(str))` the **only** thing standing between this repo and
the silent flattening of every nested operator param — `$eq`, `$in`, `$gte`, the ones `AGENTS.md`
documents on every admin list endpoint. Today deleting that line would be a mild regression; after
this ticket it is a silent, total one. Record why it is there.

### 4. The lockfile

`npm install` for the bump, then `npm update qs`. Not `npm audit fix --force` — ticket 02's warning
stands unchanged.

### Not in this ticket

A terminal error-handling middleware in `start.ts`, now that Express 5 forwards rejected promises
(§2.4). Worth doing; it is a different change with a different justification.

---

## Prove it bites

Two mutations, per `AGENTS.md`. Say in the reply that both were run.

- **The `listen` fix:** start two backends on the same port. The second must fail, not report ready.
  Before the edit it reports ready — that is the regression this exists to catch.
- **The query-parser comment is a comment,** so there is nothing to mutate. Instead confirm the claim
  behind it: with the line removed on Express 5, a request carrying `?id[$in][]=a&id[$in][]=b` must
  arrive flattened. Restore it.

---

## Risks

Ranked in §8; the three that need an action here.

1. **The silent `app.listen` success** — measured, certain to occur eventually, invisible when it
   does, and mitigated entirely by the edit above. If the ticket does one thing carefully, this is it.
2. **`req.body` is `undefined` rather than `{}` on Express 5** when a request arrives with no body and
   no content-type — *mechanism measured, absence of a call site unverified*. It would turn a working
   admin action into `400 Invalid request body: expected object, received undefined`. The search
   covered all 67 mutating `*Input` consts and the admin fetcher's `else if (data)` branch and found
   no instance, but it did not run the admin against a live Express 5 backend. **The cheap real check
   is one `npm run --workspace=admin test:e2e` run** — do that rather than reason about it. The
   backend test harness is immune because it always sets `Content-Type: application/json`.
3. **`swagger-ui-express@5.0.1` declares no Express peer range at all** — measured. It works on 5.2.1,
   but nothing in the graph *asserts* it, and `/admin/docs` and `/store/docs` have no automated test.
   Either add a small `start.ts`-level test or accept it as a dev-only surface; say which.

**Not a risk, despite looking like one:** the cross-major router mount at `/admin/queues`.
`@bull-board/express@6.21.3` depends on `express@^5.2.1` *directly*, so a 5.x router is **already**
mounted inside our 4.x app. The migration removes that mismatch rather than creating one.

**Re-check on the day:** all measurements are against Express 5.2.1. `^5.2.1` accepts 5.3+, and §5.2's
audit result should be re-run against whatever actually resolves.

---

## Where this sits

In parallel with 03, before 05 and 06.

**It makes 05 smaller, and 05 has already written the entry it deletes.**
`05-one-version-of-each-dependency.md` builds a duplicate-version gate with an `accepted` map, and its
first entry is `express: 'backend pins 4; @bull-board/express needs 5. Two majors, and only the
backend imports express.'` With `express@^5.2.1` the tree resolves to **exactly one
`node_modules/express`, at 5.2.1** (measured), and four `qs` copies collapse to one. One of 04's three
"genuine cross-major splits with no fix" turns out to have a fix, and it is this. Landing first means
04 is written against a tree where it is already true; landing second means 04 ships an
accepted-forever exception that has to be deleted a week later.

**06's fidelity argument wants the version churn finished first.** `pnpm import` reproduces the npm
lockfile's resolutions only against manifests whose specs have not changed. Changing `express`'s spec
after the import means a `pnpm up` in the pnpm world; before, it is just part of the baseline. This is
ticket 02's own argument — *"06 changes where every package resolves from; this one changes which
versions they are"* — applied word for word.

**It is disjoint from 03.** 03 edits repositories and models; this edits a platform adapter and a
manifest line. Two branches at once. The only interaction is 03's stated one: whichever lands second
regenerates the lockfile in that branch's format.

---

## Acceptance criteria

- [ ] `apps/backend/package.json` declares `express` at `^5.2.1`; `@types/express`,
      `swagger-ui-express`, `@bull-board/express` and `@types/swagger-ui-express` are all untouched
- [ ] `src/framework/runtime/express/app.ts` has **no functional change** — only the query-parser
      comment. If something in it did need changing, the research was wrong and the PR should say so
- [ ] `start.ts`'s `listen` promise rejects on a bind error, and the two-backends-on-one-port mutation
      was run in both directions
- [ ] Exactly one `node_modules/express` (5.2.1) and one `node_modules/qs` (6.16.0) resolve in the
      tree
- [ ] `npm audit` reports **4**, down from 6, with only the `@esbuild-kit` / `esbuild` / `drizzle-kit`
      chain left — ticket 03's. Before/after counts go in the PR body, because no gate reads a
      lockfile until ticket 08 lands `npm run audit`
- [ ] `npm run verify` green
- [ ] `npm run verify:full` green with the test database up
- [ ] `npm run --workspace=admin test:e2e` green — this is the check for risk 2, and the only one that
      exercises the admin fetcher's no-body path against a real Express 5 backend
- [ ] `npm run --workspace=store test:e2e` green
- [ ] `/admin/docs`, `/store/docs` and `/admin/queues` were opened by hand and render — none of the
      three has an automated test, and `swagger-ui-express` declares no peer range
