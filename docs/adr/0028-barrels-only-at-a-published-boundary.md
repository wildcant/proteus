# 28. A Barrel Lives Only at a Published Boundary, Because That Is the Only Place a Namespace Is Consumed Whole

**Status:** Accepted

## Context

ADR-0016's commit emptied the backend's module barrels and left the decision procedure in
`standards/rules/backend/modules/__docs__/modules.md`:

> a barrel exists only where something consumes the namespace *whole*, and when it does, say which
> consumer and why.

Nothing checked it. `modules.md`'s enforcement table had no row for it, no dependency-cruiser config
mentioned barrels, and `module-holds-only-known-file-kinds` anchors one level deep — a re-added
`services/index.ts` matched the allowed `services/` prefix and passed. The convention held for
exactly as long as someone remembered it.

It had not held. Sixty-six files re-exported through a barrel, and
`.scratch/pnpm-migration/knip-triage.md` had already measured what went through them: of the
eighteen names `core/utils/index.ts` re-exported, five were ever imported, and one of those five
accounted for 148 of its 168 importers. `core/types/` was two levels of `export *` over 40 leaf
files, and the deep paths its own code already used outnumbered the barrel imports.

The gap between the two numbers is the whole argument. A barrel is a claim that the namespace is a
unit. When four names out of eighteen are taken, the claim is false, and what is left is a file that
makes the module graph wider, makes dependency-cruiser resolve less precisely, and hides which of
nine repositories a line actually reached for.

## Decision

**Biome's `performance/noBarrelFile`, at `error`, repo-wide — and the exemption is a *published
boundary*.**

A published boundary is a file a `package.json` `exports` map names. That is the restatement of the
existing principle rather than a carve-out from it: a package's entry point is the one file whose
consumers genuinely do take the namespace as a unit, because the package *is* the unit — the map is
the statement of what the package is, and there is no smaller thing to import.

Nine files qualify. Each is listed in `biome.json`'s `noBarrelFile` override, and the reason each one
is there is here:

| File | The consumer that takes the namespace whole |
| --- | --- |
| `packages/ui/src/index.ts` | `@proteus/ui` — 198 importers across admin and store |
| `packages/utils/src/index.ts` | `@proteus/utils` — 21 |
| `packages/icons/src/index.ts` | `@proteus/icons` — 6 |
| `packages/testing/index.ts` | `@proteus/testing` — 9 e2e suites |
| `packages/http-schemas/src/admin/index.ts` | `@proteus/http-schemas/admin` — 97 |
| `packages/http-schemas/src/store/index.ts` | `@proteus/http-schemas/store` — 50 |
| `packages/http-schemas/src/auth/index.ts` | `@proteus/http-schemas/auth` — 19 |
| `apps/backend/src/test-exports.ts` | the backend's `./test` export; `packages/testing/fixtures/test-extend.ts` builds one `Factories` object from 60 of its names |
| `apps/backend/src/link-modules/modules-definitions.ts` | the one exemption that is not an `exports` entry, and the reason is that a *different* check already names it: `no-module-internals` lists it beside `container.ts` and `schema.gen.ts` as one of three files allowed to see inside `src/modules/`, and `no-link-definition-leaks` fences who may read it. Deleting it means widening `no-module-internals` to all of `link-modules/`, which is strictly less precise than the file it would remove |

Biome's rule is blunter than the principle: it flags any non-type `export … from`, whether or not the
file is otherwise a barrel, and it ignores `export type * from` and `export type { … } from`. Both
edges were taken as they are. The false-positive edge is the nine exemptions above. The
false-negative edge — that a type-only barrel would pass — was deliberately **not** used as an escape
hatch for `core/types/`, which is 99% types and could have kept its 16 files by changing `export *`
to `export type *`. Types are erased, so the runtime argument for that is sound and the rest of the
argument is not: dependency-cruiser still resolves through it, and a reader still cannot see which
of 40 files a name came from.

## Consequences

Fifty files deleted, 243 rewritten, and no runtime behaviour changed — every removed re-export had a
concrete file behind it, and `typecheck` was the oracle for the codemod that repointed the imports.

Three shapes changed rather than disappeared:

- `packages/http-schemas` had two levels of barrel. The sub-barrels are inlined into the three entry
  files, so `src/admin/index.ts` names 45 leaves where it used to name 13 directories. The
  `import '../openapi-setup.js'` at the top of each entry stays: it is the only thing that runs
  `extendZodWithOpenApi(z)`, and it keeps working because the entry is still the entry.
- `packages/icons/icons/index.ts` is written by `build:icons` and is now emitted as `index.gen.ts`,
  which the existing `!**/*.gen.ts` exclusion covers. A generated barrel is a generator's business,
  not an exemption.
- `packages/frontend-structure`'s `no-loose-feature-files` used to permit a feature-root `index.ts`
  as "the feature's public face". No feature ever had one, ADR-0020 explains why one would turn the
  latent `cart`/`checkout` cycle into a real one, and the Biome rule now forbids it outright. The
  allowance is removed rather than left as a contradiction between two checks.

`apps/backend/src/core/types/lifecycle.ts` went with them. `ApplicationLifecycle` had no
implementation and no importer; it was reachable only because a barrel re-exported it, which is the
class of thing this ADR is about.

## What this rejects

**Splitting the package entry points too.** `@proteus/ui` could publish 39 subpath exports and
`@proteus/http-schemas` could publish per-resource ones, which is what the rule would say if the
exemption did not exist. That is ~370 further import sites, an `exports` map per component, and — for
http-schemas — relocating the `extendZodWithOpenApi` side effect into every leaf schema file, since
nothing would load the entry any more. The payoff is bundle graph width in the two frontends, which
is a measurement nobody has taken here. It stays available and it is not this change.

**Supersedes in part:** ADR-0005, whose "Consequences" describe `core/types/index.ts` as the barrel
consumers import. The central-types decision itself stands — the contracts still live in
`core/types/` — but they are reached by concrete path.
