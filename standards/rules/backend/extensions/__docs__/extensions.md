# Extensions

A store's own backend code goes in an extension, `src/extensions/<ext>/`, beside Proteus rather
than inside its files, so merging Proteus into the fork never conflicts with it. This covers where
each kind of file goes, the names it must carry, and the steps for each kind.

How registration works, what removing an extension leaves behind and the debugging notes are
mechanism, in [`src/extensions/README.md`](../../../../../apps/backend/src/extensions/README.md).
The worked example is the fixture extension,
[`tests/extension-fixture/fixture/`](../../../../../apps/backend/tests/extension-fixture/fixture/).
Read it beside this.

## Structure

```
src/extensions/<ext>/
  extension.ts            # export default defineExtension({ name: '<ext>' })
  keys.ts                 # export const <Ext>Modules = { NAME: defineModuleKey<IService>('<ext>.<module>') }
  events.ts               # export const <Ext>Events = { NAME: defineEvent<Payload>({ name: '<ext>.<event>' }) }
  config.ts               # the extension's settings, typed constants
  types/                  # its contracts: service types, DTOs
  modules/<module>/       # the core module layout: index.ts, database.config.ts, models/,
                          #   repositories/, services/, migrations/, __tests__/
  api/store/<domain>/     # definitions.ts + route.ts, matchers under /store/
  api/hooks/<domain>/     # webhook routes, matchers under /hooks/
  workflows/              # createWorkflow({ name: '<ext>.<workflow>' }, …)
  hooks/<hook>.ts         # export const handler = defineHookHandler(someCoreHook, { run })
  providers/fulfillment/  # fulfillment providers: AbstractFulfillmentProvider subclasses and their declarations
  subscribers/            # export const config: SubscriberConfig<…> = { name: '<ext>.<subscriber>', … }
  jobs/                   # export const config: JobDefinition = { name: '<ext>.<job>', … }
  seeds/<step>.ts         # export default step, typed ExtensionSeedStep
  schemas/                # zod schemas only the backend uses
  locales/                # the extension's catalog, extracted and compiled, never hand-written
packages/http-schemas/src/extensions/<ext>/
  store/<domain>/…        # schemas the storefront also uses
  admin/<domain>/…        # schemas the admin also uses
  locales/                # their catalog
```

Every entry is optional; a small extension is a small folder. `hooks/` holds workflow hook
handlers, and `api/hooks/` holds webhook routes. The two share a word and nothing else.

## Names

A name an extension adds to a namespace core also writes into carries the extension's name as a
prefix, in that namespace's form. A name core adds in a later release then cannot land on it.

| Namespace | Form | For `pisos-dj` | Checked by |
|---|---|---|---|
| The extension (folder and manifest) | lowercase words joined by hyphens | `pisos-dj` | `extensions:generate` |
| Tables, indexes, constraints, enums | snake prefix | `pisos_dj_shipping_rates`, `pisos_dj_shipping_rates_city_idx` | `check:schema` |
| A module's migrations table | `migrations_<snake prefix><module>` | `migrations_pisos_dj_shipping` | `check:schema` |
| Module keys, event names | dot prefix | `pisos-dj.shipping`, `pisos-dj.quote_requested` | `extensions:generate` |
| Workflow, subscriber and job names | dot prefix | `pisos-dj.quote-shipping` | `workflows:generate`, `subscribers:generate`, `jobs:generate` |
| Operation ids | camel prefix | `pisosDjListShippingCities` | `extensions:generate` |
| Fulfillment provider identifiers | snake prefix | `pisos_dj_courier`, registered as `fp_pisos_dj_courier_default` | `extensions:generate` |
| OpenAPI component names | Pascal prefix | `PisosDjShippingCity` | `extensions:generate` |
| Exported model identifiers | camel prefix | `pisosDjShippingRateTable` | `typecheck`, on the `export *` in `src/schema.gen.ts` |

Index and constraint names are prefixed too, so name them explicitly
(`liveIndex('fixture_notes_core_product_id_idx')`). SQL id prefixes (ADR-0003) stay free, because
an id is unique only within its table. Hook names are core's: core defines every hook, and an
extension only handles one.

## Rules

### Add to core, never replace it

An extension cannot serve a route core serves, reuse a core module key, event, operation id or
component name, or take a workflow, subscriber or job name core has. Each one fails generation.
To change how core computes something, register a handler for the hook core exposes at that
point ([hooks](../../workflows/__docs__/hooks.md)). Where core has no hook, the change is an
upstream one: core adds a hook only together with the workflow that needs it.

### What a fork must not do

- **Edit a Proteus file for an extension's sake.** That includes the `Modules` enum, the contracts in
  `src/core/types/container.ts`, `src/container.ts`, `src/routes.ts`, `src/core/event-bus/events.ts`,
  the backend's and HTTP schemas' own catalogs, `scripts/seed-dev.ts` and `src/config.ts` for a
  store-only value. A merge conflicts on each of these edits.
  The fork does own one edit: the HTTP schemas catalog loaders (see the catalog checklist).
- **Import one extension from another.** Extensions never know about each other. Code two extensions
  share belongs in one of them.
- **Import extension code from anywhere outside the extension.** Core reaches an extension only
  through the generated registries.
- **Hand-edit `registry.gen.ts` or `seeds.gen.ts`.** Run the generator.
- **Import `src/extensions/seeds.gen.ts`.** Only `scripts/seed-dev.ts` imports it, so a seed may read
  files without reaching workerd.
- **Import a file-system module (`node:fs`, …) from a file the workerd entry reaches.** workerd has no
  file system. A seed may, because no runtime root imports a seed.
- **Add a table to a core module.** Give the extension its own module.
- **Declare an admin route, or `features` on a module.** Both need permission keys, which are a
  closed core list, and extension permissions do not exist yet.
- **Bring a payment or notification provider, or any provider that needs a secret.** Only
  fulfillment providers are supported (see [a fulfillment provider](#a-fulfillment-provider)). A
  secret goes through `src/env.ts`, a Proteus file, and extension payment and notification
  providers are deferred.
- **Link an extension module with a core module.** Links between them are not supported yet.
  Store the core id instead (next rule).

### Point at a core row by its id, never by a foreign key

An extension table stores the id of the core row it is about as plain text, and declares no
`.references()` to a core table or another extension's table. Core's soft-delete cascade is built
per module from that module's own tables (ADR-0016), so it never sees an extension. **A core row's
soft delete leaves the extension's rows untouched**, and they keep naming a hidden row. Read the
core row through its module's service, and treat "not found" as the row being gone.

### Settings are typed constants in the extension

A value only the store uses goes in the extension's `config.ts` as an exported constant, typed like
any other code. It is not an env variable, not an entry in `src/config.ts`, and not an option passed
to a module loader. A secret still goes through `src/env.ts`, which is a Proteus file. A
store-only secret is a fork-owned edit there, like the renames in
[`docs/deployment.md`](../../../../../docs/deployment.md#starting-a-new-store-from-this-codebase).

### Routes live under `/store/` or `/hooks/`

A route in `api/store/` has a matcher starting `/store/`, and one in `api/hooks/` starts `/hooks/`.
The rest of the path is free (`/store/shipping-cities`). Namespace auth decides the actor from that
prefix, so a route outside it would run without auth, and the generator rejects it. Also rejected:
a route that matches a core route (same method and pattern, whatever its parameter names), and a
static path in front of a core parameter route that the route sorter would let shadow it. OpenAPI
tags are a closed list, so an extension route reuses a core tag (`Tags.STORE`), and the generated
clients put it in that tag's file.

### Tests live beside the code

An extension's tests go in `__tests__/` beside what they test, as in core, and
`pnpm --filter backend run test` runs them against the test database. The test database migrates
every extension module. `createTestContainer` and `createApi` carry every extension in
`src/extensions/` beside the test fixture (`tests/setup/test-extensions.ts`), so an extension test
resolves its modules and reaches its routes as a core test does.

## Checklists

After any of these, run `pnpm --filter backend run extensions:generate` (the backend dev processes
run it at start) and commit the generated files. `pnpm run verify` fails on a stale registry.

### A module

1. Contracts in `types/`: the service type and its DTOs (not `src/core/types/`).
2. The key in `keys.ts`: `defineModuleKey<IService>('<ext>.<module>')`, inline, in the extension's
   `<Ext>Modules` object.
3. `modules/<module>/`, following [adding a module](../../modules/__docs__/adding-a-module.md#in-an-extension):
   models with prefixed names, repositories, the service, and `index.ts` as `Module(<Ext>Modules.X, …)`.
4. `database.config.ts` with `migrations: { table: 'migrations_<snake prefix><module>' }`, then
   generate its one migration.
5. `pnpm --filter backend run schema:generate`, then `db:migrate:dev`.

### A route

1. Schemas in `schemas/` (backend only), or in the HTTP schemas package when a client form shares
   them (see [a schema](#a-schema)). Component names carry the Pascal prefix.
2. `api/store/<domain>/route.ts` and `definitions.ts`, as in [routes](../../api/__docs__/routes.md#in-an-extension),
   with a camel-prefixed `operationId` and a core tag.
3. `extensions:generate`, then `pnpm run openapi:generate`.

### A workflow

1. `workflows/<name>.ts`, named `'<ext>.<name>'`, following [workflows](../../workflows/__docs__/workflows.md#in-an-extension).
2. `pnpm --filter backend run workflows:generate`. Restart the Temporal Worker.

### An event

1. In `events.ts`: `defineEvent<Payload>({ name: '<ext>.<event>' })`. Give it a `key` function
   when the payload has no `id`, or when the event happens more than once to one resource.
2. Emit it from the workflow's final step: `bus.emit(<Ext>Events.X, payload)`.
   See [events](../../subscribers/__docs__/events.md#in-an-extension).

### A subscriber

1. `subscribers/<name>.ts` exporting `config: SubscriberConfig<typeof <Ext>Events.X>`, named
   `'<ext>.<name>'`. It may subscribe to a core event as well. Follow
   [subscribers](../../subscribers/__docs__/subscribers.md).
2. `pnpm --filter backend run subscribers:generate`.

### A job

1. `jobs/<name>.ts` exporting `config: JobDefinition`, named `'<ext>.<name>'`, with a
   `CronExpression` schedule.
2. `pnpm --filter backend run jobs:generate`. It also writes workerd's cron triggers into
   `wrangler.jsonc`.

### A seed

1. `seeds/<step>.ts` with a default export typed `ExtensionSeedStep`. It receives the dev seed's
   container and logger.
2. `extensions:generate`. Steps run at the end of `db:seed:dev`, in extension-name order and then
   file-name order. The e2e database setup does not run them.

### A schema

- **Only the backend uses it:** `schemas/<name>.ts` in the extension.
- **The storefront or admin uses it too:** `packages/http-schemas/src/extensions/<ext>/store/<domain>/…`
  or `…/admin/<domain>/…`, imported by path (`@proteus/http-schemas/extensions/<ext>/store/<domain>/payloads`).
  Add files only: no `index.ts`, no barrel. Each file sets up the OpenAPI extension of zod itself.
  The package's [extensions README](../../../../../packages/http-schemas/src/extensions/README.md) has the details.

### A catalog

1. Mark the message with `i18n.t('…')` from `@proteus/utils`, as core does.
2. `pnpm --filter backend run i18n:extract`, translate `locales/es.po`, then
   `pnpm --filter backend run i18n:compile`. For HTTP schemas messages, use the same two scripts with
   `--filter @proteus/http-schemas`.
3. `extensions:generate`, so the registry imports the compiled catalog.
4. HTTP schemas messages only: the storefront and the admin load the extension's catalog in a
   fork-owned edit to `apps/store/src/lib/i18n/catalogs.ts` and `apps/admin/src/lib/i18n/catalogs.ts`.
   In each language's loader, add `import('@proteus/http-schemas/extensions/<ext>/locales/<lang>')`
   and spread its `messages` beside the schemas' messages.
5. If `pnpm run dev:translations` is running, restart it after the extension's first message. It
   reads the list of catalogs only when it starts.

### A fulfillment provider

1. A class in `providers/fulfillment/` extending `AbstractFulfillmentProvider`, with a static
   `identifier` carrying the snake prefix (`pisos_dj_courier`). A core identifier, or another
   extension's, fails generation.
2. The same file declares it as its default export,
   `ModuleProvider(Modules.FULFILLMENT, { services: [YourProvider] })`. The generator reads that
   export, and the fulfillment module merges it after core's providers. The fixture extension's
   `providers/fulfillment/city-rates.ts` is the worked example.
3. Its constructor receives `ExtensionProviderDependencies` (`core/extensions/extension.ts`): a
   `resolve` that answers module services only, its own extension's by their module keys (its rate
   table) and core's by `Modules`. `getDb`, the logger, the link service, the event bus and the
   other `ContainerRegistrationKeys` don't compile, and throw if forced; a module's repositories and
   models were never on the shared container.
4. For a calculated option, `calculatePrice(optionData, data, context)` receives the option's
   `data`, the method's `data` and the Cart (its items with variant weight and dimensions, and its
   shipping address), and returns the calculated amount and whether it includes tax. When it can't
   price this address or these items, it throws the port's typed "can't calculate" error, and the
   option is left out of the Cart's options. Anything it needs later, such as a delivery estimate,
   goes in what `validateFulfillmentData` returns, which is stored on the shipping method. The
   fulfillment module's [README](../../../../../apps/backend/src/modules/fulfillment/README.md#the-calculateprice-contract)
   has the whole contract.
5. `extensions:generate`. The fulfillment module registers the provider at bootstrap, and the
   provider sync writes its row: at boot on Node, and through `scripts/seed-providers.ts` before a
   workerd deploy.
6. The admin creates a shipping option that uses it, with the price type `calculated`. Creation
   asks the provider's `canCalculate`, and refuses the option with the code
   `fulfillment_cannot_calculate` when it answers false.

### A hook handler

1. `hooks/<hook>.ts`: `export const handler = defineHookHandler(someCoreHook, { run, compensate? })`.
   One handler per hook across all extensions.
2. `extensions:generate`. Restart the Temporal Worker.
3. Follow [hooks](../../workflows/__docs__/hooks.md#a-handler-returns-small-plain-data-and-does-nothing-else).

## Enforcement

| Check | What it enforces |
|---|---|
| `extensions:generate` / `check:extension-registry` | the extension name; prefixes on module keys, events, operation ids and component names; no collision with core or another extension; route prefixes, no admin route, no core route matched or shadowed; prefixed fulfillment provider identifiers that collide with no core provider; one handler per hook; no catalog translating a message differently from another; that the committed registries are current |
| `workflows:generate`, `subscribers:generate`, `jobs:generate` (and their `check:` scripts) | the dot prefix on workflow, subscriber and job names, and no duplicate with core |
| `check:workerd-crons` | that `wrangler.jsonc` lists every enabled job's schedule |
| `check:schema` (`extension-database-names`, `extension-foreign-keys`) | prefixed tables, indexes, constraints, enums and migrations tables; no foreign key out of the extension |
| `check:structure` | no import between extensions, no file-system import a workerd root reaches, only the dev seed imports the seed registry, and the module and API layouts |
| `omits-hook-errors` | that a workflow or route running a hook spreads its `throws` |
| `typecheck` | `Module(key, …)` against the type the key carries, no `features` on an extension module, the payload of an extension event |

## What is deliberately not enforced

- **That settings are constants in `config.ts`.** A value read from somewhere else is behaviour, not a
  shape.
- **That an extension row survives its core row.** Nothing can check this: the core row's soft delete
  happens at runtime, and the extension's handling of "not found" is its own code.
- **Prefixes on exported model identifiers.** A clash fails `typecheck` on the `export *` lines in
  `src/schema.gen.ts`. Only a clash matters, so no rule checks the prefix itself.
