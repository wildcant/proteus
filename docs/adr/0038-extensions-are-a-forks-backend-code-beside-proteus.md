# 38. Extensions Are a Fork's Backend Code Beside Proteus, and Hooks Are Its Only Way into Core

**Status:** Accepted. Amends ADR-0004, ADR-0005, ADR-0009, ADR-0023, ADR-0027, ADR-0029 and ADR-0031,
as set out under [Amendments](#amendments).

## Context

A store built from Proteus is a fork that merges Proteus regularly. The backend had no way in for a
store's own code, so every feature a store added for itself was an edit to a Proteus file. A new
module edited the closed `Modules` list, the container's service contracts and the bootstrap list. A
route edited the hand-written route list. A store's data went into a table inside a Proteus module
(one store's per-city shipping rates ended up in the fulfillment module). Its dev data edited the dev
seed, its messages landed in the backend's catalogs, its shared schemas went beside Proteus's, and
changing how core computes an order's charges meant editing a core workflow.

Each of those edits conflicted on the next merge, and some failed silently: a later Proteus table
with the same name as a store's breaks the database, though the merge itself was clean. Stores
either stopped syncing or spent their syncs resolving conflicts in code they never meant to change.

**Prior art.** Medusa's plugins are packages of modules, API routes, workflows, workflow hooks,
links, subscribers, jobs and admin extensions. They are registered in its config, with options
passed to their modules. Medusa's workflow hooks are named points in a core workflow: one handler,
a returned value the workflow may use, and optional compensation. Proteus takes the hook almost
unchanged, but not the package shape. A fork needs isolation from upstream, not distribution to
other stores.

## Decision

**An extension is a folder of the store's own backend code, `apps/backend/src/extensions/<ext>/`.**
It mirrors core's folders: a manifest, modules in core's closed layout, store and webhook routes,
workflows, hook handlers, subscribers, jobs, dev seeds, backend-only schemas, its own message
catalog, its own types, and its settings as typed constants. Every part is optional. A fork usually
has one extension. It may have several, and they never import each other. Proteus ships none: only
the empty folder, its docs and a fixture extension under `tests/` that the test suite exercises.

**Extensions add; they never replace.** A route, module key, event, workflow, subscriber, job,
operation id or OpenAPI component that collides with core fails generation. So does a static
extension path that would shadow a core parameter route. Every name an extension adds to a shared
namespace carries its name as a prefix, in that namespace's form: `pisos_dj_` in the database,
`pisos-dj.` for runtime names, `pisosDj`/`PisosDj` for identifiers. A core name added later then
cannot collide with it. SQL id prefixes (ADR-0003) stay free, since an id is unique per table.

**Registration is generated.** `extensions:generate` reads the extension folders without running
them and writes two committed files of static imports. `src/extensions/registry.gen.ts` holds
manifests, modules, routes, hook handlers and compiled catalogs, and is what the runtime roots read.
`src/extensions/seeds.gen.ts` holds the seed steps and is imported only by the dev seed. The workflow,
subscriber and job generators read the extension folders beside core's. workerd has no file system,
and the Temporal Worker runs steps in its own process, so both need static imports. `verify` checks
every generated file.

**The container bootstrap, route preparation and the translator take the registry as a
dependency.** The runtime roots pass the generated registry, and the test suite passes the fixture's.
Extension modules bootstrap after core's, each in its own private container (ADR-0001). Extension
routes join the store and webhook arrays, so namespace auth, validation, error mapping and OpenAPI
apply unchanged.

**A hook is core's one way to let a store change a computation.** Core defines a hook next to the
workflow that runs it, with a name, input and output types, a fallback (core's own behaviour) and
the error types it may raise. An extension registers at most one handler, and a second handler
fails generation. In a workflow, a hook is always exactly one step, `hook:<name>`, whether or not a
handler exists. The handler is resolved inside the step, so the step sequence Temporal replays by
never depends on which extensions are deployed. The step output records which handler produced
it, and compensation runs only if that same handler is still registered. Outside a workflow,
`runHook` runs the handler without compensation. Core adds a hook only together with the workflow
that needs it. The first, an order's charges, ships with draft orders.

**Extension tables hold no foreign keys to core tables.** They store the core id. Core's cascade is
derived per module (ADR-0016), so a core row's soft delete leaves extension rows untouched.

## Amendments

**ADR-0004 (link modules).** An extension module points at a core row by storing its id as plain
text, with no link and no foreign key. Links between an extension module and a core module are not
supported yet.

**ADR-0005 (central types).** An extension's contracts (service types, DTOs) live in the extension's
own `types/`, not in `src/core/types/`. Core's contracts stay core-only. An extension module's key
(`defineModuleKey<IService>('<ext>.<module>')`) carries its service type, so `AppContainer.resolve`
and `Module()` type it without the closed `Modules` list or `ModuleServiceContracts` naming the
extension.

**ADR-0009 (workflow engine).** Hooks join the workflow vocabulary in `src/core/workflows/hooks.ts`:
`defineHook`, `defineHookHandler`, `hookStep` and `runHook`. They are built on `ctx.step` and add no
member to `WorkflowContext` or `WorkflowEngine`, so neither adapter changes. Handlers live on the
container. The engine holds one global container, so `.run()` uses the last container built, and a
test needing another handler builds its container last.

**ADR-0023 (event bus).** Besides core's closed `EventPayloads` map, the bus accepts extension
events: values from `defineEvent` that carry their payload type and their deduplication key (the
payload's `id`, or a key function). `emit` and `SubscriberConfig` take either. Subscribers are still
written to the weaker adapter's guarantees.

**ADR-0027 (layer graph).** The extension registry joins the route list, the container and the
workflow, subscriber and job registries as composition-root nodes, so core still never imports
extension code. The graph gains extension layers that mirror core's, and three rules: no import
between extensions, no file-system import reachable from the workerd entry, and only the dev seed
imports the seed registry.

**ADR-0029 (cron).** workerd's cron triggers in `wrangler.jsonc` are no longer hand-synced.
`jobs:generate` writes them in place from the job list, core's and the extensions' jobs together,
and `check:workerd-crons` fails on drift.

**ADR-0031 (translation).** Each extension has its own catalog, extracted separately. Core's
Lingui configs exclude `src/extensions/`, so a fork's messages never touch core's catalogs. The
backend translator merges extension catalogs after core's, in extension-name order. Generation fails
when two catalogs translate one message differently. Validation issues are translated against the
merged catalog, so an extension schema's messages are translated too. The storefront and admin load
an extension's HTTP schemas catalog through a fork-owned edit to their `catalogs.ts`.

## Considered Options

**Extensions as workspace packages (Medusa's shape).** Rejected for now. A fork needs its code to
stay out of upstream's files, not to be published, and a package adds a build boundary, a manifest
and a version to every store-only feature. A unit that proves reusable across stores can graduate to
a package later.

**Runtime discovery of extension folders.** Rejected. workerd cannot read a directory at runtime.
The Temporal Worker would discover a different set from the API's if the two were deployed apart.
`tsc` and the structure check can only see an import.

**Overriding core routes, workflows or subscribers.** Rejected. An override silently stops upstream
fixes from reaching the fork, which is the opposite of what syncing is for. Hooks give the same reach
at points core has agreed to hold still.

**Several handlers per hook, chained.** Rejected. Which code ran would depend on the order of
registration, and compensation would have to unwind a chain.

## Deferred

- Extension admin routes and permissions. Admin routes need permission keys, which are a closed core
  list, so `extensions:generate` rejects them, and `Module()` rejects `features` on an extension module.
- Extension OpenAPI tags. Tags are a closed list, so extension routes reuse a core tag.
- Links between extension modules and core modules.
- Extension-owned providers. On workerd, provider rows come from a seed script that lists core
  modules.
- Foreign keys from extension tables to core tables.
- Running extension seeds in the e2e database.
- Publishing extensions as packages, and extensions reused across stores.

## Consequences

- A fork adds backend features without editing a Proteus file, apart from the renames
  `docs/deployment.md` lists and the two `catalogs.ts` edits for shared schema messages.
- A new extension file does nothing until its generator runs. The dev processes run the generators
  at start and watch `src/extensions/**`, and `verify` fails on a stale registry.
- The Temporal Worker imports extension workflows and hook handlers at start, so it must be
  restarted after a change, and the API and the Worker deploy together.
- Removing an extension is deleting its folder and regenerating. Its tables stay until a database
  reset, in-flight runs of its workflows fail without retry, queued events for its subscribers fail,
  and the cron Worker sweeps its schedules.
- Upstream has no real extension, so the fixture extension is what keeps the mechanism from
  regressing.

## References

- `apps/backend/src/extensions/README.md`: the mechanism, removal and debugging
- `standards/rules/backend/extensions/__docs__/extensions.md`: layout, names, checklists
- `standards/rules/backend/workflows/__docs__/hooks.md` and `apps/backend/src/framework/workflows/README.md#hooks`
- `apps/backend/scripts/generate-extension-registry.ts`, `scripts/extension-names.ts`,
  `scripts/runtime-sources.ts`, `scripts/generate-workerd-crons.ts`
- `apps/backend/tests/extension-fixture/`: the fixture extension and its journey test
