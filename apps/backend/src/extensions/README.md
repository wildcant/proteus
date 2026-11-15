# Extensions

An extension is a store's own backend code, kept in a folder of its own here
(`src/extensions/<ext>/`) instead of inside Proteus's files. A store built from Proteus is a fork that
merges Proteus regularly. Code the fork puts in an extension never conflicts with that merge.
Proteus ships this folder empty: just this README, its `AGENTS.md` and the two generated registries.
A fork usually has one extension. It may have several, and they never import each other.

How to build one (the layout, the name prefixes, the steps for each kind of file, what a fork must
not do) is in
[`standards/rules/backend/extensions/__docs__/extensions.md`](../../../../standards/rules/backend/extensions/__docs__/extensions.md).
This file is how the mechanism behaves. ADR-0038 records why it is shaped this way.

Two other things in this backend share the names:

- **Postgres extensions** (`pg_trgm`) are database extensions, created before any module migrates
  by `scripts/create-database-extensions.ts` from the list in `scripts/database-extensions.ts`. They
  have nothing to do with this folder.
- **Workflow hooks** are the extension mechanism's way into core behaviour: a named point in a core
  workflow, run as `hookStep`, which an extension handles in its `hooks/` folder. **Webhooks** are
  the `/hooks/` API scope, which an extension's `api/hooks/` routes join. The hook mechanism is in
  [`src/framework/workflows/README.md`](../framework/workflows/README.md#hooks).

## Registration is generated

Nothing is discovered at runtime. Generators read the extension folders and write committed files
of static imports, and the composition roots read those files. workerd has no file system at
runtime, and the Temporal Worker runs steps in its own process, so both need static imports.

| Written by | File | Holds | Read by |
|---|---|---|---|
| `extensions:generate` | `src/extensions/registry.gen.ts` | manifests, modules, store and webhook routes, hook handlers, compiled catalogs | the container bootstrap, route preparation, the translator |
| `extensions:generate` | `src/extensions/seeds.gen.ts` | seed steps | `scripts/seed-dev.ts` only |
| `workflows:generate` | `src/framework/workflows/temporal/registry.gen.ts` | core's and the extensions' workflows | the Temporal Worker |
| `subscribers:generate` | `src/subscribers/registry.gen.ts` | core's and the extensions' subscribers | the event bus adapters |
| `jobs:generate` | `src/jobs/registry.gen.ts`, and `triggers.crons` in `wrangler.jsonc` | core's and the extensions' jobs, and the distinct schedules of the enabled ones | the cron Worker; workerd |
| `schema:generate` | `src/schema.gen.ts` | every model file, the extensions' included | `getDb()` |

All the scripts are `pnpm --filter backend run …`. Each has a `check:` twin in `pnpm run verify`'s
generated gate (`check:extension-registry`, `check:workflow-registry`, `check:subscriber-registry`,
`check:job-registry`, `check:workerd-crons`, `check:schema-registry`).

`extensions:generate` also refuses what would let an extension replace core: an unprefixed or
duplicate name, a route that matches or shadows a core route, an admin route, and a second handler
for one hook. It reads every name as a string literal without running the code, so a name built at
runtime is rejected because it cannot be checked.

The container bootstrap (`src/container.ts`) and route preparation (`src/routes.ts`) take the
registry as a dependency rather than importing it. Every runtime root (the API on Node and on
workerd, the three Temporal Workers) passes the generated one. The test suite passes the fixture
extension's registry instead.

## What the runtime does with an extension

- **Modules** bootstrap after core's, each into its own private container, through the same
  `bootstrapModule`. A module's key (`defineModuleKey`) carries its service type, so
  `resolve(key)` is typed without core's closed `Modules` list or its service contracts naming the
  extension. At runtime the key is just the string Awilix registers.
- **Hook handlers** go on every container `bootstrapContainer` builds, keyed by hook name.
  `hookStep` and `runHook` read them back from whichever container they are handed.
- **Routes** join route preparation's store and webhook arrays, so namespace auth, validation,
  error mapping, OpenAPI registration and sorting treat them exactly as core's. The generated
  OpenAPI documents and clients include them under the core tag they reuse.
- **Events** are values (`defineEvent`), not entries in core's `EventPayloads` map. Each carries
  its payload type and its deduplication key: the payload's `id` unless the event says otherwise.
  `bus.emit` and `SubscriberConfig` accept them beside core's event names.
- **Translations.** The translator merges each extension's catalogs after core's, in extension-name
  order: first the extension's HTTP schemas messages, then its own. Validation issues are translated
  against that merged catalog, so an extension schema's messages come back translated like core's.
  The generator fails when two catalogs translate one message differently, so the order never
  decides what a request reads.
- **Database.** Each extension module has its own `database.config.ts` and migrations table.
  `db:generate` and `db:migrate` loop over the extension configs beside core's and skip the glob
  when no extension exists. The test database setup migrates them, the fixture's included. Schema
  checks and the database diagram include extension models.
- **Seeds** run at the end of `db:seed:dev`, in extension-name order and then file order, against
  the dev seed's container. No runtime root imports the seed registry, so a seed may read files. The
  e2e database setup does not run them.

Core's soft-delete cascade is derived per module from that module's own tables (ADR-0016), and an
extension table holds no foreign key into core. So a core row's soft delete leaves extension rows
untouched, still holding the id of a row that is now hidden.

## Removing an extension

Delete its folder (and its folder under `packages/http-schemas/src/extensions/`, and its lines in the
storefront's and admin's `catalogs.ts`). Then run the generators: `extensions:generate`,
`workflows:generate`, `subscribers:generate`, `jobs:generate` and `schema:generate`. There is no
configuration to change. What it leaves behind:

- **Its tables stay** until the database is reset (`db:restart`, `stack:reset`). No migration drops
  them, because its migrations went with the folder.
- **In-flight runs of its workflows fail, without retry.** The Worker no longer has the workflow.
- **Queued events for its subscribers fail.** No subscriber of that name exists to deliver them to.
- **Its schedules are swept.** The cron Worker reconciles Temporal Schedules against the job list
  at boot and deletes the ones no job defines (ADR-0029). On workerd, the regenerated
  `wrangler.jsonc` no longer lists the schedules.

## Debugging

- **A new file is invisible until its generator runs.** Registration is generated, so a module, route,
  handler, seed or catalog you just added does nothing until `extensions:generate` runs (and
  `workflows:generate`, `subscribers:generate` or `jobs:generate` for those). The backend dev
  processes (`dev`, `worker:dev`, `worker:events:dev`, `worker:cron:dev`) each run `extensions:generate`
  at start (each Worker also runs its own registry's generator) and watch `src/extensions/**`, so a
  new file restarts them. `pnpm run verify` catches a registry you
  forgot to regenerate.
- **The Temporal Worker is its own process.** It imports workflows and hook handlers when it starts.
  After a change to an extension workflow or a hook handler, restart it (`worker:dev` does this on a
  change under `src/extensions/`). In production, deploy the API and the Worker together, or one of
  them runs a handler or workflow the other does not have.
- **A hook test runs the handler of the last container built.** Handlers live on the container, but
  the workflow engine holds one global container, so a workflow's `.run()` uses whichever container
  was built last. A test that needs a different handler builds its container last with
  `createTestContainer({ hookHandlers: [...] })`, or `[]` for the fallback, and then runs the
  workflow.
- **A new catalog needs the Lingui watcher restarted.** `pnpm run dev:translations` reads the list of
  catalogs when it starts, so an extension's first message is not extracted until you restart it.
- **An admin route fails generation.** This is deliberate. Admin routes need permission keys, which
  are a closed core list, and extension permissions do not exist yet.

## The fixture extension

Upstream ships no extension, so the test suite runs one:
[`tests/extension-fixture/fixture/`](../../tests/extension-fixture/fixture/), named `fixture`. It has a
module, a migration, routes, a workflow, an event, a subscriber, a seed, a schema and a catalog.
`extensions:generate:fixture` writes its registries beside it, and `check:extension-registry` checks
them. `tests/extension-fixture/__tests__/fixture.api.test.ts` runs the whole journey through HTTP.
It is the worked example to copy from.
