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
11. As a store developer, I want my extension routes to use natural paths (for example a store path for shipping cities), so that the storefront API reads naturally.
12. As a store developer, I want a route that reuses a core method and path to fail at startup or generation, so that I never shadow core by accident.
13. As a store developer, I want my extension workflows to run on the in-process engine and on Temporal, so that they behave the same on workerd and on Node.
14. As a store developer, I want my extension workflows registered with the Temporal Worker automatically, so that I don't edit Proteus's workflow registry.
15. As a store developer, I want my extension subscribers delivered like core subscribers, so that I can react to core events.
16. As a store developer, I want to declare my own events with typed payloads, so that my subscribers and workflows share a contract without editing Proteus's event map.
17. As a store developer, I want my extension jobs scheduled on Node and on workerd without editing the workerd configuration by hand, so that a cron I add runs on both runtimes.
18. As a store developer, I want my extension's dev seed steps to run at the end of the dev seed, so that a database reset gives me my store's data without editing the seed script.
19. As a store developer, I want schemas only the backend uses to live inside my extension, so that they stay next to the routes that use them.
20. As a store developer, I want schemas my storefront or admin also use (a form) to live in an extension folder of the HTTP schemas package, importable by path, so that both sides share them without editing the package's existing files.
21. As a store developer, I want my extension's translatable messages extracted into my extension's own catalog, so that Proteus's catalogs never hold my messages and syncs stop conflicting on them.
22. As a store developer, I want my catalog merged into the backend's translations at load, so that my API errors are translated like core's.
23. As a store developer, I want the translations gate to check my catalog, so that a missing translation fails like core's.
24. As a store developer, I want my extension's tables, migration tables, workflow, subscriber, job, hook and event names prefixed with my extension's name, so that a later Proteus name can't collide with mine.
25. As a store developer, I want an unprefixed extension table or name to fail a check, so that I can't forget the prefix.
26. As a store developer, I want two extensions using the same name to fail generation, so that names stay unique across the backend.
27. As a store developer, I want an import from one extension into another to fail the structure check, so that extensions stay independent.
28. As a store developer, I want an import of a file-system module reachable from the workerd entry to fail the structure check, so that my extension doesn't break on workerd.
29. As a store developer, I want my extension's tests to live beside its code and run in the backend's test suite against the test database, so that verify covers them.
30. As a store developer, I want the generated extension registry checked by verify, so that a file I added without running the generator is caught.
31. As a store developer, I want the dev watcher to regenerate the extension registry, so that a new file shows up while I work.
32. As a store developer, I want to remove an extension by deleting its folder and running the generators, so that removal needs no configuration.
33. As a store developer, I want the README to say that a removed extension's tables stay until a database reset, so that I'm not surprised by leftover tables.
34. As a store developer, I want my extension's settings to be typed constants in my extension, so that I don't edit Proteus's config for store-only values.
35. As a store developer, I want to register one handler for a core hook, so that I can change how core computes something without editing the core workflow.
36. As a store developer, I want a second handler for the same hook to fail generation, so that which code runs is never ambiguous.
37. As a store developer, I want a hook with no handler to run core's fallback, so that core works unchanged without any extension.
38. As a store developer, I want a hook to be one step whether or not a handler is registered, so that adding or removing my handler never breaks Temporal executions in flight.
39. As a store developer, I want my handler to be able to undo its work when a later step fails, so that a hook takes part in the workflow's compensation.
40. As a store developer, I want a hook's errors declared on the workflow's error contract, so that the API maps them like core errors.
41. As a store developer, I want to call a hook outside a workflow (in a route), so that a preview and the stored result use the same code.
42. As a store developer, I want hook handlers registered per container, so that tests and processes never share handlers.
43. As a store developer, I want the docs for adding a module, a route and a workflow to have an "in an extension" variant, so that I know the steps for my case.
44. As a store developer, I want the fork documentation to point at extensions, so that new stores start the right way.
45. As a Proteus maintainer, I want Proteus to ship no extension of its own, so that core features have one way to be built.
46. As a Proteus maintainer, I want extensions to never override core routes, workflows, subscribers, jobs, events or hooks, so that upstream fixes always apply to forks.
47. As a Proteus maintainer, I want hooks added only where a store needs one, so that core doesn't grow speculative extension points.
48. As a Proteus maintainer, I want a fixture extension exercised by the test suite, so that the mechanism can't regress while no real extension lives upstream.
49. As a Proteus maintainer, I want the layer graph to name the extension layers explicitly, so that the default-deny import rules keep holding.
50. As a Proteus maintainer, I want the extension registry to be a composition-root node like the route list and the workflow registry, so that core still never imports extension code.
51. As a Proteus maintainer, I want the decision and its amendments to earlier ADRs recorded in an ADR, so that future readers know why extension contracts live outside the central types and why events and the workflow port accept extension additions.
52. As a store operator, I want an order's charges stored when the order is created, so that an order keeps the numbers its customer saw even if the store's rules change later.

## Implementation Decisions

### What an extension is

- An extension is the store's own backend code, in its own folder inside the backend's source, one folder per
  extension. Several may exist; none may import another. Proteus ships only the empty folder and its README.
- A unit that later proves reusable across stores graduates to a workspace package; that is not part of this work.
- Closed layout per extension, mirroring the core folders: a manifest (name and typed options), modules, API routes,
  workflows, hook handlers, subscribers, jobs, seeds, backend-only schemas, a message catalog, and public types.
  Every subfolder is optional.
- Extensions add, never replace: a collision with a core route (method and path), workflow, subscriber, job, event or
  hook name fails generation or route preparation. Changing core behaviour means proposing a hook upstream.

### Registration

- A new generator, built on the shared TypeScript source scanner the registry generators use, discovers extensions
  and writes one committed registry of static imports (modules, route definitions, hook handlers, seeds, manifests).
  It has a check mode that verify runs, like the other generators. Static imports are what workerd (no file system
  at runtime) and the Temporal Worker (steps run in its own process) both need.
- Proteus's composition roots read the registry: the container bootstraps extension modules after core modules with
  the existing module bootstrap; the route list adds extension routes to its store, admin and hooks arrays so route
  preparation applies auth, permission checks, OpenAPI registration and sorting unchanged; the dev seed runs
  extension seed steps at its end.
- The workflow, subscriber and job generators also scan extension folders; their outputs stay where they are. The
  fixed path prefixes they use become a relative-path computation.
- Schema generation and the migration commands include extension modules. Each extension module has its own
  database configuration and migrations table; the test database setup reads the migrations table from each
  configuration instead of deriving it from the folder name.

### Names

- Extension tables, migration tables, and workflow, subscriber, job, hook and event names carry the extension's
  prefix. A check fails on an unprefixed one, and generators fail on a duplicate across core and extensions.
- HTTP paths are free (no extension segment) and collision-checked against core.

### Typing without editing closed lists

- A module key is a branded value carrying its service's type. The container's resolve accepts a module key and
  returns that type; Proteus's own module keys and service contracts stay closed and core-only. The module factory
  accepts a module key and keeps its contract check. The container-key lint rule accepts module keys.
- An extension event is a branded value carrying its payload type. The event bus's emit and the subscriber
  configuration accept it beside Proteus's closed event map.
- Extension contracts (service interfaces, DTOs) live in the extension's own types, not in the central types
  (amends ADR-0005, since the central types belong to Proteus).
- Placement follows ADR-0026: module keys, events, hook definitions and the hook step helper are vocabulary (core);
  building the handler map and registering it on each container is runtime work (framework), called by every
  runtime root (API, Worker, workerd, tests).
- Links between an extension module and a core module are not supported yet; an extension table stores the core id
  it points at. Permissions and OpenAPI tags for extensions are deferred until an extension needs an admin route.

### Hooks

- A hook is defined in core with a name, its input and output types, a fallback (core's behaviour) and the error
  types it may raise.
- In a workflow, a hook runs through a step helper that is always exactly one step named after the hook, whether or
  not a handler exists, so the step sequence never depends on extensions (Temporal replays by step sequence). Inside
  the step it resolves the handler from the container and runs it or the fallback. A handler's optional
  compensation becomes the step's compensation. The workflow declares the hook's error types in its error contract.
- Outside a workflow, a function of the container runs the same resolution (for previews in routes).
- Exactly one handler per hook; a second fails generation. No chains.
- Handlers return small plain data (it is a step output, re-sent on every later Temporal activity), emit no events
  (events only from a workflow's final step, ADR-0024), and add no steps of their own.
- Hooks ship only with a consumer. The first is the order-charges hook, delivered with draft orders: its result is
  stored when the draft order is created, so read paths read stored values and never call the hook; only the cart's
  preview route calls it.
- Amends the workflow port (ADR-0009; the workflow engine's README requires an ADR for port changes).

### Schemas and translations

- Backend-only extension schemas live in the extension. Schemas the storefront or admin also need live in an
  extension folder of the HTTP schemas package, reached through a wildcard export the package adds once. Forks add
  files only; no index, no barrel (ADR-0028).
- Each extension has its own message catalog, extracted separately and merged into the backend's translations at
  load; the HTTP schemas package gets an extension catalog beside its own for shared schemas' messages. The
  translations gate checks them.

### Runtimes

- Cron schedules on workerd come from the job registry (generated), so a fork never edits the workerd
  configuration; the decision between generating the list and checking it against the configuration is the ADR's.
- A structure rule fails when the workerd entry can reach a file-system module.
- Extension modules that bring their own providers are deferred (on workerd, provider rows come from a seed script
  that lists core modules).

### Structure rules and docs

- The layer graph gains extension layers mirroring core (extension modules like modules, extension API like API,
  extension workflows like workflows, and so on), a rule forbidding imports between extensions, and the registry as
  a composition-root node. The top-level folder allow-list gains the extensions folder. Lint and standards rules
  keyed by path widen to the matching extension folders; unused-code checks gain extension entries.
- Docs: an extensions README and standards doc (layout, checklists, what a fork must not do); "in an extension"
  variants of the module, route and workflow docs; the fork sections of the deployment doc point at extensions; a
  new hooks doc in the workflow standards; fix the workflow standards' broken link to the workflow engine README.
- An ADR records the decision (extensions, hooks, names, schemas, translations, runtimes), Medusa's plugins and
  workflow hooks as prior art, the three amendments (ADR-0005, ADR-0023, ADR-0009) and what is deferred.

### Debugging notes the docs must state

- Registration is generated, not discovered at runtime: a new file is invisible until the generator runs; verify's
  check catches a stale registry.
- The Temporal Worker is its own process: a changed handler or extension workflow needs it restarted; the API and the
  Worker deploy together.
- Stored order charges don't follow later rule changes; resending the cart refreshes a draft.

## Testing Decisions

- Good tests assert external behaviour through the highest existing seam: what the HTTP API answers, what the
  database holds afterwards, what a workflow returns, which step sequence Temporal records. Not which internal
  function ran.
- **Main seam: a fixture extension** kept with the test setup (not in the shipped extensions folder), loaded by the
  existing backend test container and exercised through real HTTP calls to the app, as the cart API journey tests
  do. One journey covers: its module resolves through its module key; its migration ran; its route answers and
  appears in the dumped OpenAPI; its workflow runs; its subscriber receives its event; its seed ran; its message is
  translated.
- **Hooks: the Temporal parity harness.** One hook journey runs on the in-process engine and on Temporal: no handler
  gives the fallback; a handler's value is used; a handler that throws compensates earlier steps; registering a
  handler leaves the step sequence unchanged (replay); two containers in one process don't share handlers. Prior
  art: the existing workflow and replay tests and the parity harness.
- **Generator tests** like the existing registry generators': duplicate names, unprefixed names, a core route
  collision, a second handler for a hook, and the check mode on a stale registry each fail.
- **Verify gates as acceptance:** structure (no imports between extensions, no file-system module reachable from
  workerd), the workerd smoke test serving the fixture's route, the translations gate with the fixture's catalog,
  generated files.
- Every new test is proven by breaking its behaviour once and seeing it fail.

## Out of Scope

- The storefront and admin apps' own extension points (forks own their UI).
- Publishing extensions as packages (npm plugins) and reusable cross-store extensions.
- Overriding core routes, workflows, subscribers, jobs, events or hooks.
- Links between extension modules and core modules; extension permissions and OpenAPI tags; extension-owned
  providers.
- Draft orders and the order-charges hook itself: the next spec, which uses this mechanism.
- Moving a fork's existing code into its extension (done in the fork after it syncs).

## Further Notes

- Prior art: Medusa's plugins (a package of modules, API routes, workflows, workflow hooks, links, subscribers,
  jobs and admin extensions registered in its config, with options passed to its modules) and Medusa's workflow
  hooks (a named point in a core workflow, one handler, a returned value the workflow may use, optional
  compensation). Proteus takes the folder-in-the-repo shape because a fork needs isolation, not distribution.
- The motivating fork is Pisos DJ: its per-city shipping rates, shipping quote and order charges are the first code
  to move into an extension once this and draft orders land.
- Decisions recorded with the owner on 14 Nov 2026: location in the backend source; charges stored at creation;
  store's own code; Proteus ships none; hooks only with a consumer; one handler per hook; add, never replace;
  prefixed names and free paths; removal by deletion; schemas split; per-extension catalogs; permissions deferred;
  tests beside the code.
