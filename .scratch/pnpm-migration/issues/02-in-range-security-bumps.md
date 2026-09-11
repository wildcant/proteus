# 02 — The eighteen advisories that fix inside the declared range

**What to build:** every advisory that a bump within the existing semver range closes is closed, on
npm, before the package manager changes. The five Drizzle ones are ticket 03 and are explicitly out
of scope here.

**Blocked by:** nothing. Runs before 06 on purpose — see *Why it lands before pnpm*.

**Status:** planned.

**Spec:** `.scratch/pnpm-migration/spec.md`, P1 — F1, F2.

---

## Why

`npm audit` on 2026-09-11: **23 advisories — 12 high, 11 moderate, 0 critical**. Nine are on direct
dependencies. Eighteen fix inside the range already declared, which makes them a lockfile refresh
rather than a code change.

The high-severity ones, named so the PR can say what it closed:

| Package | Advisory |
| --- | --- |
| `undici` | cross-user information disclosure and parse-time crash via degenerate private cache directives |
| `sharp` | libheif GHSA-g89c-p67h-r497 and GHSA-2jg2-4ch7-h545 |
| `js-yaml` | YAML merge-key chains force quadratic CPU; `!!omap` quadratic resolution |
| `nanoid` | custom generators loop indefinitely when size is zero |
| `brace-expansion` | DoS via unbounded expansion length, OOM crash; and a second bypassing the CVE-2026-14257 mitigation |
| `browserslist` | unbounded memory growth, no cache eviction; prototype write via untrusted `browserslist-stats.json` |
| `fast-uri` | host confusion via literal backslash authority delimiter |
| `miniflare` | via `sharp` and `undici` |
| `@cloudflare/vite-plugin`, `wrangler`, `orval` | via `miniflare` / `js-yaml` |

Moderate, on direct dependencies: `@hono/node-server` (unauthenticated memory-leak DoS via aborted
WebSocket handshake), `hono` (ReDoS in the CORS middleware; `memo()` retaining SSR output across
requests — **cross-user data disclosure**, and this repo server-renders), `qs` (array-limit bypass;
DoS via attacker-controlled `isBuffer`), `express` and `body-parser` via `qs`, `postcss` (arbitrary
`.map` read via attacker-controlled `sourceMappingURL`).

`qs` is worth a second look rather than a bump and a shrug: it is a **direct** dependency of both
`apps/backend` and `apps/admin`, and `AGENTS.md` documents it as the query parser for nested operator
params (`$eq`, `$in`, `$gte`) on every admin list endpoint. The array-limit bypass is reachable from a
query string.

## Why it lands before pnpm

So that a regression is attributable. Ticket 06 changes where every package resolves from; this one
changes which versions they are. Run together, a broken test could be either. `verify` and
`verify:full` must be green on npm at the end of this ticket, and that green run is the baseline 05
is judged against.

---

## The work

Take the fixes explicitly. A dry run shows the shape — `wrangler` 4.114.0 → 4.131.1, `workerd`
1.20260722.1 → 1.20260911.1, `undici` 7.28.0 → 7.29.0, `sharp` 0.35.2 → 0.35.4, `postcss` 8.5.19 →
8.5.28, `orval` 8.22.0 → 8.31.0, plus `js-yaml`, `nanoid`, `browserslist`, `node-releases`,
`update-browserslist-db` transitively.

### Never run `npm audit fix --force`

The installed `drizzle-kit` is **0.31.10**. npm's proposed fix for its advisory is
**`drizzle-kit@0.18.1`** — a rollback past every migration this repo has generated, because the
advisory is on `@esbuild-kit/esm-loader` and npm's solver reaches for the last version that did not
depend on it. `--force` would take it. This is the single most damaging command available in this
ticket; the PR should say it was not run.

`npm audit fix` without `--force` is safe (it declines semver-major changes) but still opaque. Prefer
naming the bumps, so the diff says what was intended.

---

## Acceptance criteria

- [ ] `npm audit` reports **0** advisories that a bump inside the declared range would close; the
      only remainder is the Drizzle chain owned by ticket 03, and `npm audit --json` is quoted in the
      PR to show exactly what is left
- [ ] `drizzle-kit` is still at 0.31.x and `drizzle-orm` still at 0.39.x — untouched by this ticket
- [ ] `npm run verify` green
- [ ] `npm run verify:full` green with the test database up
- [ ] `npm run --workspace=backend test:temporal` green against a running Temporal server — `workerd`
      and the Temporal chain both move here, and no other gate covers that suite
- [ ] Both Playwright e2e suites green — `wrangler`, `workerd` and `@cloudflare/vite-plugin` move,
      and the store runs on workerd
- [ ] The admin and store both build (`npm run --workspace=admin build`, `--workspace=store build`) —
      `orval`, `postcss` and `browserslist` are all build-path
