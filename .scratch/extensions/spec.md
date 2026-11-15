# Extensions: a store's backend code beside Proteus, not inside it

## Problem Statement

A store built from Proteus is a fork that merges Proteus regularly. Every backend feature the store adds for itself
has to be written inside Proteus's own files, because the backend has no other way in:

- A new module edits the closed list of module keys, the container's service contracts and the container's bootstrap
  list.
- A new API route edits the hand-written route list.
- New data lands as a table inside a Proteus module (a store's per-city shipping rates ended up in the fulfillment
  module).
- A store's dev data edits the dev seed.
- A store's validation messages are extracted into the backend's message catalogs, whose reference lines drift on
  every sync.
- A store's shared HTTP schemas go into the HTTP schemas package beside Proteus's.
- Changing how core computes something (an order's charges) means editing a core workflow.

Each of those edits is a conflict on the next merge of Proteus into the fork, and some are silent: a later Proteus
table with the same name as a store's breaks the database. Stores either stop syncing or spend their syncs resolving
conflicts in code they never meant to change.

## Solution

Proteus gains **extensions**: a folder per extension inside the backend where a store puts its own modules, API
routes, workflows, subscribers, jobs, seeds, schemas, message catalog and types. Proteus never ships anything into
that folder (only an empty folder, its README and a test fixture elsewhere). A generator discovers extensions and
writes one committed registry of static imports; Proteus's composition roots read it. A fork can then add
backend features without editing a Proteus file, and its syncs no longer conflict on them.

Where a store needs to change core behaviour, core exposes a **hook**: a named point in a core workflow with a
fallback (core's own behaviour). An extension registers at most one **handler** for it. The first hook is the one
a real store needs: an order's charges when a cart becomes a draft order (delivered by the draft-orders work that
follows this spec).

An extension is the store's own code, not a reusable product: usually one per fork, several allowed, never importing
each other. Extensions add; they never replace core.

## User Stories

1. As a store developer, I want to put my backend code in an extension folder, so that merging Proteus never conflicts with it.
2. As a store developer, I want an extension to hold modules, API routes, workflows, subscribers, jobs, seeds, schemas, a message catalog and types, so that every kind of backend feature has a place.
3. As a store developer, I want every extension subfolder to be optional, so that a small extension is a small folder.
4. As a store developer, I want my extension modules to follow the same closed layout as core modules, so that the module standards and habits apply unchanged.
5. As a store developer, I want my extension modules to get their own private container like core modules, so that module isolation holds for my code too.
6. As a store developer, I want to resolve my extension module's service from the container with full typing, so that I don't need to edit Proteus's list of module keys or service contracts.
7. As a store developer, I want my extension module's tables to be migrated with the same commands as core's, so that a database reset sets up my tables too.
8. As a store developer, I want my extension's migrations regenerated in place like core's, so that I follow the same migration workflow.
9. As a store developer, I want my extension's API routes served through the same route preparation as core's, so that authentication, validation, error handling and OpenAPI apply unchanged.
10. As a store developer, I want my extension routes to appear in the generated OpenAPI documents and clients, so that my storefront calls them with a typed client.
11. As a store developer, I want my extension routes under the usual store or webhook prefix but otherwise free paths (for example a store path for shipping cities), so that authentication applies and the storefront API reads naturally.
12. As a store developer, I want a route that matches or shadows a core route (same method and pattern, whatever its parameter names, or a static path in front of a core parameter route) to fail generation, so that I never shadow core by accident.
13. As a store developer, I want my extension workflows to run on the in-process engine and on Temporal, so that they behave the same on workerd and on Node.
14. As a store developer, I want my extension workflows registered with the Temporal Worker automatically, so that I don't edit Proteus's workflow registry.
15. As a store developer, I want my extension subscribers delivered like core subscribers, so that I can react to core events.
16. As a store developer, I want to declare my own events with typed payloads and an identity for deduplication, so that my subscribers and workflows share a contract without editing Proteus's event map.
17. As a store developer, I want my extension jobs scheduled on Node and on workerd, with the workerd cron list generated, so that a cron I add runs on both runtimes without a hand edit.
18. As a store developer, I want my extension's dev seed steps to run at the end of the dev seed, so that a database reset gives me my store's data without editing the seed script.
19. As a store developer, I want schemas only the backend uses to live inside my extension, so that they stay next to the routes that use them.
20. As a store developer, I want schemas my storefront or admin also use (a form) to live in an extension folder of the HTTP schemas package, importable by path, so that both sides share them without editing the package's existing files.
21. As a store developer, I want my extension's translatable messages extracted into my extension's own catalog, so that Proteus's catalogs never hold my messages and syncs stop conflicting on them.
22. As a store developer, I want my catalog merged into the backend's translations at load, including the translation of validation issues, so that my API errors and my schemas' messages are translated like core's.
23. As a store developer, I want the translations gate to check my catalog, so that a missing translation fails like core's.
24. As a store developer, I want every name my extension adds to a shared namespace (module key, tables, indexes, constraints and enums, migration tables, workflow, subscriber, job and event names, OpenAPI component names and operation ids, exported model identifiers) to carry my extension's prefix in the form that namespace uses, so that a later Proteus name can't collide with mine.
25. As a store developer, I want an unprefixed extension table or name to fail a check, so that I can't forget the prefix.
26. As a store developer, I want two extensions using the same name to fail generation, so that names stay unique across the backend.
27. As a store developer, I want an import from one extension into another to fail the structure check, so that extensions stay independent.
28. As a store developer, I want an extension file reachable from the workerd entry that imports a file-system module to fail the structure check, so that my extension doesn't break on workerd.
29. As a store developer, I want my extension's tests to live beside its code and run in the backend's test suite and in verify's test gate against the test database, so that verify covers them.
30. As a store developer, I want the generated extension registry checked by verify, so that a file I added without running the generator is caught.
31. As a store developer, I want every backend dev process (API and the three Workers) to regenerate the extension registry and watch extension folders, so that a new file shows up while I work.
32. As a store developer, I want to remove an extension by deleting its folder and running the generators, so that removal needs no configuration.
33. As a store developer, I want the README to say what removing an extension leaves behind (its tables until a database reset; in-flight runs of its workflows fail without retry; queued events for its subscribers fail; its schedules are swept), so that I'm not surprised.
34. As a store developer, I want my extension's settings to be typed constants in my extension, so that I don't edit Proteus's config for store-only values.
35. As a store developer, I want to register one handler for a core hook, so that I can change how core computes something without editing the core workflow.
36. As a store developer, I want a second handler for the same hook to fail generation, so that which code runs is never ambiguous.
37. As a store developer, I want a hook with no handler to run core's fallback, so that core works unchanged without any extension.
38. As a store developer, I want a hook to be one step whether or not a handler is registered, and its compensation to run only for the handler that produced the step's output, so that adding, removing or changing my handler never breaks Temporal executions in flight.
39. As a store developer, I want my handler to be able to undo its work when a later step fails, so that a hook takes part in the workflow's compensation.
40. As a store developer, I want a hook's errors declared on the error contract of every workflow and route that runs it, enforced by lint rules, so that the API maps them like core errors.
41. As a store developer, I want to call a hook outside a workflow (in a route) for side-effect-free handlers, so that a preview and the stored result use the same code.
42. As a store developer, I want hook handlers registered per container and replaceable in a test container, so that a test can run with and without a handler.
43. As a store developer, I want the docs for adding a module, a route and a workflow to have an "in an extension" variant, so that I know the steps for my case.
44. As a store developer, I want the fork documentation to point at extensions, so that new stores start the right way.
45. As a Proteus maintainer, I want Proteus to ship no extension of its own, so that core features have one way to be built.
46. As a Proteus maintainer, I want extensions to never override core routes, workflows, subscribers, jobs, events or hooks, so that upstream fixes always apply to forks.
47. As a Proteus maintainer, I want hooks added only where a store needs one, so that core doesn't grow speculative extension points.
48. As a Proteus maintainer, I want a fixture extension exercised by the test suite, so that the mechanism can't regress while no real extension lives upstream.
49. As a Proteus maintainer, I want the layer graph to name the extension layers explicitly, so that the default-deny import rules keep holding.
50. As a Proteus maintainer, I want the extension registry to be a composition-root node like the route list and the workflow registry, so that core still never imports extension code.
51. As a Proteus maintainer, I want the decision and its amendments to earlier ADRs recorded in an ADR, so that future readers know why extension contracts live outside the central types and why events and the workflow port accept extension additions.
52. As a store developer, I want extension tables never to hold foreign keys to core tables, and the docs to say a core row's soft delete leaves my rows untouched, so that core's cascade rules stay intact.
53. As a store developer, I want extension seeds run in a fixed order (extension name), from a seed registry the runtime never imports, so that dev seeds can read files without reaching workerd.
54. As a store developer, I want an extension admin route to be rejected with a clear message until extension permissions exist, so that I don't hit a startup failure later.
55. As a store developer, I want the schema checks and the database diagram to include my extension models, so that my tables follow the same rules as core's.
56. As a Proteus maintainer, I want the migration commands to work when no extension exists, so that Proteus itself keeps migrating.
57. As a Proteus maintainer, I want the extension API excluded from the production unused-code check by a tag until a fork uses it, so that verify passes upstream with an empty extensions folder.

## Implementation Decisions

### What an extension is

- An extension is the store's own backend code, in its own folder inside the backend's source, one folder per
  extension. Several may exist; none may import another. Proteus ships only the empty folder, its README and an
  agent guide.
- A unit that later proves reusable across stores graduates to a workspace package; that is not part of this work.
- Closed layout per extension, mirroring the core folders: a manifest (name), modules, API routes, workflows, hook
  handlers, subscribers, jobs, seeds, backend-only schemas, a message catalog, and public types. Every subfolder is
  optional. The extension's settings are typed constants in its own folder; they are not passed to module loaders.
- "Extension" here is the store mechanism; the docs keep it apart from Postgres extensions (database extensions
  created by the migration script). "Hooks" here are workflow hooks; the docs keep them apart from webhooks (the
  hooks API scope).
- Extensions add, never replace: a collision with core fails generation (see Names and Routes).

### Registration

- A new generator, built on the shared TypeScript source scanner the registry generators use, discovers extensions
  and writes committed registries of static imports. It has a check mode that verify runs, like the other
  generators. Static imports are what workerd (no file system at runtime) and the Temporal Worker (steps run in its
  own process) both need.
- **Runtime registry**: modules, route definitions, hook handlers, compiled message catalogs, manifests. Read by the
  container bootstrap and route preparation, which take it as a dependency (not a hard-wired import), so tests can
  pass a different registry. The default composition roots pass the generated one.
- **Seed registry**: seed steps only, imported only by the dev seed script; a structure rule forbids anything under
  the backend source from importing it, so a seed may read files without reaching workerd. Seeds run at the end of
  the dev seed in extension-name order. The e2e database setup does not run them.
- The container bootstraps extension modules after core modules with the existing module bootstrap; hook handlers
  are registered once in the shared container bootstrap, which every runtime root (API, Worker, workerd, tests) goes
  through.
- Route preparation adds extension routes to its store and webhook arrays, so namespace auth, OpenAPI registration
  and sorting apply unchanged.
- The workflow, subscriber and job generators also scan extension folders; their outputs stay where they are and
  become composition-root nodes in the layer graph. The fixed path prefixes they use become a relative-path
  computation.
- Schema generation, the schema checks and the database diagram include extension modules. Each extension module has
  its own database configuration and migrations table; the migration commands skip the extension glob when it
  matches nothing; the test database setup reads the migrations table from each configuration.
- The feature (permission) generator ignores extensions; the module factory rejects features for extension modules.
- Every backend dev process (API and the three Workers) runs the extension generator at start and watches extension
  folders.

### Names

- One extension-name format (lowercase, digits and hyphens, e.g. `pisos-dj`), mapped to each namespace's form:
  tables, indexes, constraints, enums and migration tables in snake case (`pisos_dj_…`); workflow, subscriber, job
  and event names and module keys with a dot (`pisos-dj.…`); OpenAPI component names, operation ids and exported
  model identifiers in camel or Pascal case (`pisosDj…`). Generators check names in code; the schema check checks
  database names. SQL id prefixes (ADR-0003) stay free, since ids are unique per table.
- Hooks are defined in core, so their names are core's; only handlers live in extensions.
- Generators fail on a duplicate across core and extensions (including module keys, which the container would
  otherwise overwrite silently).

### Routes

- Extension store routes start with the store prefix and webhook routes with the webhook prefix; the rest of the path
  is free. Namespace auth decides the actor from that prefix, so a route outside it would run without auth.
- Extension admin routes are rejected by the generator with a clear message until extension permissions exist
  (admin routes requiring auth must declare permission keys, a closed list).
- The collision check compares normalized patterns (parameter names ignored) and rejects a static extension path in
  front of a core parameter route that the route sorter would let shadow it.
- OpenAPI tags are a closed list, so extension routes reuse a core tag; the generated clients then place them in that
  tag's file. Extension tags are deferred.

### Typing without editing closed lists

- A module key is a branded value carrying its service's type, declared in a per-extension keys object that the
  container-key lint rule recognises by pattern. The container's resolve accepts a module key and returns that type;
  Proteus's own module keys and service contracts stay closed and core-only. The module factory accepts a module key
  and keeps its contract check.
- An extension event is a branded value carrying its payload type and its deduplication identity (the payload's id,
  or a key function for repeatable events). The event bus's emit and the subscriber configuration accept it beside
  Proteus's closed event map.
- Extension contracts (service interfaces, DTOs) live in the extension's own types, which get their own layer node.
- Extension tables hold no foreign keys to core tables; they store the core id they point at. A core row's soft
  delete leaves extension rows untouched (core's cascade graph is per module). Links between an extension module and
  a core module are not supported yet.
- Placement follows ADR-0026: module keys, events, hook definitions and the hook step helper are vocabulary (core);
  registering handlers on a container is the container bootstrap's (framework). A hook's definition, including its
  fallback, lives next to the core workflow that runs it.

### Hooks

- A hook is defined with a name, its input and output types (output limited to what the workflow payload converter
  carries: plain JSON, dates and big numbers), a fallback (core's behaviour) and the error types it may raise.
- In a workflow, a hook runs through a step helper that is always exactly one step named `hook:<name>`, whether or
  not a handler exists, so the step sequence never depends on extensions (Temporal replays by step sequence). Inside
  the step it resolves the handler from the container and runs it or the fallback. The step output records which
  handler produced it; compensation runs only if that same handler is still registered, so a handler added, removed
  or changed between a step and its rollback never undoes another's work. The step helper isn't seen by the step
  label scanner; it only loses its label in the Temporal UI.
- Outside a workflow, a function of the container runs the same resolution, but only the handler's run, never its
  compensation; handlers of hooks that may run outside a workflow must be free of side effects.
- Exactly one handler per hook; a second fails generation. No chains. A handler never calls another workflow's run.
- Handlers return small plain data (it is a step output, re-sent on every later Temporal activity), emit no events
  (events only from a workflow's final step, ADR-0024), and add no steps of their own.
- Error contract: lint rules require every workflow that runs a hook step and every route that runs a hook to declare
  the hook's error types; a handler error not in them is reported as an unexpected-state error.
- Isolation: handlers live on the container, but the workflow engine holds one global container, so a workflow's
  `.run()` uses the last container built; tests that need a different handler build their container with a
  replaced handler map and run the workflow against it. The docs state the caveat.
- Hooks ship only with a consumer; the first (order charges) comes with draft orders, the next spec.
- Amends the workflow port (ADR-0009; the workflow engine's README requires an ADR for port changes).

### Schemas and translations

- Backend-only extension schemas live in the extension. Schemas the storefront or admin also need live in an
  extension folder of the HTTP schemas package, split by scope (`extensions/<ext>/store/…`, `…/admin/…`) so the
  store's rule against admin schemas still applies, reached through a wildcard export the package adds once. Forks
  add files only; no index, no barrel (ADR-0028). Each such file sets up the OpenAPI extension of zod itself, since
  it can load before the package's barrels. The bounded-schema test covers them.
- Each extension has its own message catalog; both core Lingui configurations exclude the extensions folder from
  extraction, and each extension's catalog is extracted separately. Compiled catalogs travel in the runtime
  registry (static imports, for workerd).
- The backend translator merges extension catalogs after core's, in extension-name order; a check fails when two
  catalogs define the same message with different translations.
- Validation-issue translation takes the merged catalog (today it only translates messages from the HTTP schemas
  package's own catalog), so extension schemas' messages are translated. The storefront and admin load the HTTP
  schemas extension catalog through a fork-owned edit; the docs say where.

### Runtimes

- workerd cron triggers are generated in place in the workerd configuration from the job registry, keeping its other
  fields and comments; verify's generated gate checks them (amends ADR-0029, which keeps them hand-synced).
- A structure rule fails when an extension file reachable from the workerd entry imports a file-system module.
  (Core's local file provider already reaches one; it is out of this rule's scope.)
- Extension modules that bring their own providers are deferred (on workerd, provider rows come from a seed script
  that lists core modules).

### Structure rules and docs

- The layer graph gains extension layers mirroring core (extension modules like modules, extension API like API,
  extension workflows like workflows, extension types, and so on), extension variants of the module-layout,
  API-layout, cross-module and module-test-location rules, a rule forbidding imports between extensions, the runtime
  registry and the workflow, subscriber and job registries as composition-root nodes, an edge from the framework's
  i18n to the registry, and a rule that only the dev seed imports the seed registry. The top-level allow-list gains
  the extensions folder and the registry file. Lint and standards rules keyed by path widen to the extension folders.
- Unused-code checks gain extension entries; the extension and hook API carries a tag excluded from the production
  check until a fork uses it.
- Verify's test gate includes extension tests.
- Docs: an extensions README and agent guide (layout, checklists, what a fork must not do, removal effects); "in an
  extension" variants of the module, route, workflow and events docs and of the container-resolution doc; the fork
  sections of the deployment doc point at extensions; a hooks doc in the workflow standards; fix the broken links to
  the workflow engine README in the workflow standards.
- An ADR records the decision, Medusa's plugins and workflow hooks as prior art, the amendments (ADR-0004 core ids
  without a link, ADR-0005 extension contracts, ADR-0009 workflow port, ADR-0023 extension events, ADR-0027 new
  composition-root nodes, ADR-0029 generated crons, ADR-0031 merged catalogs and issue translation) and what is
  deferred.

### Debugging notes the docs must state

- Registration is generated, not discovered at runtime: a new file is invisible until the generator runs; verify's
  check catches a stale registry.
- The Temporal Worker is its own process: a changed handler or extension workflow needs it restarted; the API and the
  Worker deploy together.

## Testing Decisions

- Good tests assert external behaviour through the highest existing seam: what the HTTP API answers, what the
  database holds afterwards, what a workflow returns, which step sequence Temporal records. Not which internal
  function ran.
- **Main seam: a fixture extension** kept with the test setup. The generator, pointed at it, writes a committed test
  registry that verify checks; the backend test container and route preparation take that registry as their
  dependency; the test database setup applies the fixture's migrations. One journey, through real HTTP calls to the
  app as the cart API tests do, covers: its module resolves through its module key; its migration ran; its route
  answers; its workflow runs; its subscriber receives its event; its seed ran; its message and its schema's
  validation message are translated. OpenAPI is asserted in memory through route preparation with the fixture
  registry.
- **Hooks: the Temporal parity harness.** One hook journey runs on the in-process engine and on Temporal: no handler
  gives the fallback; a handler's value is used; a handler that throws compensates earlier steps; registering a
  handler leaves the step sequence unchanged (replay); compensation is skipped when the handler that produced the
  output is gone; a test container with a replaced handler map runs its own handler.
- **Generator tests** like the existing registry generators': duplicate and unprefixed names, a module-key collision,
  a core route collision and a shadowing static path, an extension admin route, a second handler for a hook, catalog
  conflicts, the generated workerd crons, and the check mode on a stale registry each fail.
- **Rule tests**: the structure and lint rules for extensions (imports between extensions, file-system import
  reachable from workerd, seed registry imported from the backend source, layout rules, hook error contract) are
  tested with the rule-test fixtures the repo uses for its existing rules, and a structure run over the fixture.
- **Verify gates as acceptance**: generated files (registries, crons, test registry), structure, standards, unused
  code with the tag, translations with the fixture's catalog, the widened test gate, and the existing workerd smoke
  test (which boots the real configuration, not the fixture).
- Every new test is proven by breaking its behaviour once and seeing it fail.

## Out of Scope

- The storefront and admin apps' own extension points (forks own their UI).
- Publishing extensions as packages (npm plugins) and reusable cross-store extensions.
- Overriding core routes, workflows, subscribers, jobs, events or hooks.
- Links between extension modules and core modules; extension admin routes, permissions and OpenAPI tags;
  extension-owned providers; foreign keys from extension tables to core tables.
- Running extension seeds in the e2e database.
- Draft orders and the order-charges hook itself, including storing an order's charges at creation so an order
  keeps the numbers its customer saw: the next spec, which uses this mechanism.
- Moving a fork's existing code into its extension (done in the fork after it syncs).

## Further Notes

- Prior art: Medusa's plugins (a package of modules, API routes, workflows, workflow hooks, links, subscribers,
  jobs and admin extensions registered in its config, with options passed to its modules) and Medusa's workflow
  hooks (a named point in a core workflow, one handler, a returned value the workflow may use, optional
  compensation). Proteus takes the folder-in-the-repo shape because a fork needs isolation, not distribution.
- The motivating fork is Pisos DJ: its per-city shipping rates, shipping quote and order charges are the first code
  to move into an extension once this and draft orders land.
- Decisions recorded with the owner on 14 Nov 2026: location in the backend source; charges stored at creation
  (next spec); store's own code; Proteus ships none; hooks only with a consumer; one handler per hook; add, never
  replace; prefixed names and prefix-scoped free paths; removal by deletion; schemas split; per-extension catalogs;
  permissions deferred; tests beside the code; the extension API tagged out of the production unused-code check;
  workerd crons generated in place; the names "extension" and "hooks" kept, disambiguated in the docs.
- A review against the code (14 Nov) shaped the test seams, the seed registry, route prefixes, translation of
  validation issues, hook compensation and error contract, name forms and the ADR amendments.
