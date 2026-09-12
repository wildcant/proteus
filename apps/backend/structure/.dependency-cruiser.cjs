/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-module-internals',
      comment:
        'Only composition roots (container.ts, schema.gen.ts, modules-definitions.ts) ' +
        "and a module's own files may import from src/modules/.",
      severity: 'error',
      from: {
        pathNot:
          '^src/modules/|^src/(container\\.ts|schema\\.gen\\.ts)$|^src/link-modules/modules-definitions\\.ts$|^tests/',
      },
      to: {
        path: '^src/modules/',
      },
    },
    {
      name: 'no-cross-module-imports',
      comment: 'A module may not import from a sibling module.',
      severity: 'error',
      from: {
        path: '^src/modules/([^/]+)/.+',
      },
      to: {
        path: '^src/modules/([^/]+)/.+',
        pathNot: '^src/modules/$1/.+',
      },
    },
    {
      name: 'no-link-definition-leaks',
      comment:
        'link-modules/definitions/ and modules-definitions.ts must only be ' +
        'imported from within link-modules/ or schema.gen.ts.',
      severity: 'error',
      from: {
        pathNot: '^src/(link-modules/|schema\\.gen\\.ts$)',
      },
      to: {
        path: '^src/link-modules/(definitions/|modules-definitions\\.ts$)',
      },
    },
    {
      name: 'no-api-internals',
      comment:
        'Only src/routes.ts and the API layer itself may import from src/api/. A route is the ' +
        'outermost layer — it exists to turn a Request into a call on something below it — so an ' +
        'import pointing back up at one is a layer inversion, and what is being reached for is ' +
        'always either a schema, which lives in packages/http-schemas and is already shared, or ' +
        'logic that belongs in a module service or in a workflow when it spans modules. ' +
        'This is no-module-internals one layer up: that rule names the composition roots allowed to ' +
        'see inside modules/, this one names the single composition root allowed to see inside api/.',
      severity: 'error',
      from: {
        pathNot: '^src/api/|^src/routes\\.ts$',
      },
      to: {
        path: '^src/api/',
      },
    },
    {
      name: 'business-layers-do-not-import-the-runtime',
      comment:
        'modules/, workflows/, subscribers/, link-modules/ and providers/ may not import ' +
        'src/framework/ or src/routes.ts. This is the core/framework split stated as a rule: core/ ' +
        'is what is *known* and framework/ is what *runs*, so a layer that holds business logic may ' +
        'name the first and never the second. Concretely it stops that logic learning it was reached ' +
        'over HTTP — HttpRequest and HttpResult live in framework/http/ports.ts — when the same ' +
        'service and the same workflow also run from a Temporal Worker, a queue consumer and a ' +
        'scheduled job, where there is no request to take a shape from. What a caller supplies ' +
        'arrives as a DTO, which is why a module service can be constructed in a test with no ' +
        'process at all. ' +
        'The one thing these layers used to need from framework/ was noopLogger, a null-object ' +
        'implementation of the core Logger port that had no business in the adapter layer; it now ' +
        'lives at core/logger/noop-logger.ts, which is what lets this rule name all of framework/ ' +
        'rather than carving out a subfolder. ' +
        '__tests__/ is exempt: a test may build the runtime it is testing against — two workflow ' +
        'tests construct the in-process engine from framework/workflows/simple-adapter.ts, which is ' +
        'the engine doing its job, not a workflow reaching for it. ' +
        'no-api-internals covers the other request-shaped path, src/api/ itself, and for a different ' +
        'reason — it is about who may see a route, not about who may know what a request is.',
      severity: 'error',
      from: {
        path: '^src/(modules|workflows|subscribers|link-modules|providers)/',
        pathNot: '__tests__/',
      },
      to: {
        path: '^src/framework/|^src/routes\\.ts$',
      },
    },
    {
      name: 'no-direct-factory-imports-in-tests',
      comment:
        'Test files must use the dto/factories fixtures from test-extend.ts, ' +
        'not import generators from tests/factories/ directly.',
      severity: 'error',
      from: {
        path: '__tests__/.+',
      },
      to: {
        path: '^tests/factories/',
      },
    },
    {
      name: 'no-direct-bignumber-import',
      comment:
        'Only src/core/bignumber.ts may import from bignumber.js. ' +
        'All other code should use the BigNumber wrapper. That wrapper deliberately holds nothing ' +
        'but the class: the Drizzle column type lives next door in src/core/db/bignum.ts, so code ' +
        'that only needs the value type — the Temporal workflow sandbox bundle included — does not ' +
        'drag drizzle-orm/pg-core in with it. The one exception is packages/http-schemas, which has ' +
        'no business depending on backend internals at all.',
      severity: 'error',
      from: {
        pathNot: '^src/core/bignumber\\.ts$|packages/http-schemas/',
      },
      to: {
        path: 'bignumber\\.js',
      },
    },
    {
      name: 'no-stripe-outside-its-provider',
      comment:
        'Only src/providers/payment-stripe/ may import the Stripe SDK. Everything else reaches a ' +
        'gateway through the PaymentProvider port, so a stripe import anywhere else is a vendor ' +
        'detail escaping its adapter — the difference between adding a second provider as a ' +
        'registration and adding it as a rewrite. Two exemptions, both about faking the gateway ' +
        "rather than calling it: __tests__/, where a test driving the adapter needs Stripe's own " +
        'error classes and event shapes to build what the real gateway would have sent, and ' +
        'tests/mocks/vitest/, the SDK stand-in itself — it can only stand in for Stripe by ' +
        'importing it. Test scaffolding outside those two goes through the stand-in.',
      severity: 'error',
      from: {
        pathNot: '^src/providers/payment-stripe/|__tests__/|^tests/mocks/vitest/',
      },
      to: {
        path: '(^|/)node_modules/stripe/',
      },
    },
    {
      name: 'no-temporal-in-workerd',
      comment:
        'The workerd bundle must not reach Temporal. @temporalio/worker pulls in ' +
        '@temporalio/core-bridge, a native addon workerd cannot load, so a stray import here is a ' +
        'broken deploy rather than dead weight. src/container.ts therefore takes the Temporal ' +
        'engine as an injected factory instead of importing the adapter, exactly as it takes its ' +
        'logger and dbProvider — this rule is what keeps that boundary deliberate rather than ' +
        'incidental. Reachability, not a direct import: the hazard is transitive. ' +
        "The event bus paths are listed alongside the workflow engine's: `@temporalio/` already " +
        'catches them transitively, but naming them is what makes a future Temporal-shaped file ' +
        'that has not yet imported the SDK fail here rather than on a deploy.',
      severity: 'error',
      from: {
        path: '^src/index\\.workerd\\.ts$',
      },
      to: {
        path:
          '@temporalio/|^src/framework/temporal/|^src/framework/workflows/temporal(-adapter\\.ts$|/)' +
          '|^src/framework/event-bus/temporal(-adapter\\.ts$|/)',
        reachable: true,
      },
    },
    {
      name: 'shared-temporal-stays-shared',
      comment:
        'src/framework/temporal/ is the Temporal plumbing the workflow engine and the event bus ' +
        'both build on: the client, the payload converter, the failure encoding. It may reach core/ ' +
        'freely — BigNumber, AppError, the DTO types, the workflow port type are all *known* things ' +
        "— and nothing else in src/framework/, least of all the workflow engine's own Temporal " +
        'internals in src/framework/workflows/temporal/. The dependency runs one way: the engine ' +
        'imports the plumbing, never the reverse. Without this rule the split rots the first time ' +
        'someone "shares" a workflow helper by moving it back into src/framework/temporal/, and the ' +
        'shared folder quietly becomes the workflow engine again. ' +
        'It sits under src/framework/ rather than src/core/ because connecting to a server is ' +
        'something that *runs*. That is also what makes the rule simpler than it used to be: when ' +
        'this folder lived in core/ the exemption list had to enumerate the core primitives it was ' +
        'allowed to reach, because every import was read against its own layer. Now core/ is below ' +
        'it and needs no exemption at all — only the framework siblings do. ' +
        'ping.ts is the one exemption: it is an operator script (`pnpm temporal:ping`) rather ' +
        "than plumbing — it starts the driver's own pingWorkflow on the workflow task queue, and " +
        'nothing imports it, so it takes nothing with it.',
      severity: 'error',
      from: {
        path: '^src/framework/temporal/',
        pathNot: '^src/framework/temporal/ping\\.ts$',
      },
      to: {
        path: '^src/framework/',
        pathNot: '^src/framework/temporal/',
      },
    },
    {
      name: 'event-bus-and-workflows-stay-peers',
      comment:
        'The event bus and the workflow engine are peers that must not import each other, on either ' +
        'side of the core/framework line — core/ holds their ports, framework/ holds their engines, ' +
        'and none of those four folders may reach the other feature. ' +
        'They share a vendor on node — the workflow engine runs workflow executions, the bus runs ' +
        'standalone activities — and that is exactly the coupling this forbids: a fix ' +
        "in the engine's replay code must be structurally incapable of changing event dispatch, " +
        'which it is only while dispatch never enters that file. What they genuinely share (the ' +
        'client factory, the payload converter, the failure encoding) lives in src/framework/temporal/, ' +
        'which ' +
        'shared-temporal-stays-shared keeps from growing back into either of them. ' +
        'Direct imports, not reachability, and deliberately so: a subscriber that runs a workflow ' +
        'is the designed path — src/subscribers/ may reach both — and a workflow step that ' +
        "publishes needs the bus's port type. Both would fail a reachable rule while being the " +
        'thing the split exists to allow. The hazard is shared machinery, and machinery is imported.',
      severity: 'error',
      from: {
        path: '^src/(?:core|framework)/(event-bus|workflows)/',
      },
      to: {
        path: '^src/(?:core|framework)/(event-bus|workflows)/',
        pathNot: '^src/(?:core|framework)/$1/',
      },
    },
    {
      name: 'subscribers-name-no-transport',
      comment:
        'A subscriber must not name the transport that delivers it. There are two, with two delivery ' +
        'guarantees, and every subscriber is written to the weaker of them — at-least-once, no dedup, the ' +
        'one Cloudflare Queues offers — so that one file runs unchanged on node and on workerd. An import ' +
        'that names a runtime is what makes that untrue: reading `env` from `cloudflare:workers`, or ' +
        "typing a handler against a queue message, turns a subscriber into one runtime's subscriber, and " +
        'the other runtime is where that is discovered. Direct imports, not reachability, and for the ' +
        'reason event-bus-and-workflows-stay-peers gives: a subscriber that runs a workflow or resolves ' +
        'anything the container holds is the designed path, and a reachable rule would forbid it. ' +
        'This says out loud what two rules already caught for reasons of their own — neither of which is ' +
        'a statement about subscribers, so neither survives a refactor that changes its reason. ' +
        '`@temporalio/` here fails no-temporal-in-workerd, but transitively, because the workerd entry ' +
        'reaches the subscriber through registry.gen.ts; the queues adapter fails no-circular, because ' +
        'that adapter imports the registry and the import closes the cycle. `cloudflare:workers` was ' +
        'caught by neither: worker-configuration.d.ts declares the module, so it type-checks and cruises ' +
        'clean, and the first thing to notice is every node process that loads the registry failing at ' +
        'import time. ' +
        'registry.gen.ts is subject to this like every other file here, and passes as generated — it ' +
        'imports the subscriber configs and the event-bus types, never an adapter. So do the tests in ' +
        '__tests__/, which build events through events.ts rather than through a transport.',
      severity: 'error',
      from: {
        path: '^src/subscribers/',
      },
      to: {
        path:
          '@temporalio/|cloudflare:' +
          '|^src/framework/event-bus/(cloudflare-queues-adapter\\.ts$|temporal(-adapter\\.ts$|/))',
      },
    },
    {
      name: 'no-circular',
      comment: 'No circular dependencies allowed.',
      severity: 'error',
      from: {},
      to: {
        circular: true,
      },
    },
  ],
  /**
   * A rule about where a file may *sit*, which dependency-cruiser has no direct way to express.
   *
   * The mechanism: a `required` rule is module-scoped — it selects modules with `module.path`, then
   * asserts each one has a dependency matching `to`. A `to.path` that can never match makes every
   * selected module fail, so the rule reads as "no module may exist at this path". No import edge is
   * involved, which is the whole point: a `forbidden` rule is evaluated per edge and therefore cannot
   * see a misplaced file that imports nothing — and a helper nobody has imported yet is exactly the
   * file this is meant to catch. Same primitive as packages/frontend-structure, same caveat: it
   * uses a documented feature in a way the docs never describe.
   */
  required: [
    {
      name: 'src-holds-only-known-top-level-entries',
      comment:
        'A new top-level folder under src/ is a new architectural layer, so it is added by editing ' +
        'this list — not by an author who needed somewhere to put a file. Every kind of code already ' +
        'has a home: an HTTP route in api/, the ports and primitives every layer shares in core/, a ' +
        'scheduled task in jobs/, a cross-module join in link-modules/, tables and business logic in ' +
        'modules/, a third-party adapter in providers/, work caused by something that happened in ' +
        'subscribers/, and cross-module orchestration in workflows/. A folder that fits none of them ' +
        'is a decision rather than a convenience, and a decision comes with a rule saying what may ' +
        'import it — the way subscribers/ has subscribers-name-no-transport. ',
      severity: 'error',
      module: {
        path:
          '^src/' +
          '(?!(?:api|core|framework|jobs|link-modules|modules|providers' +
          '|subscribers|workflows)/)' +
          '(?!(?:config|container|env|index|index\\.workerd|routes|schema\\.gen|schema\\.type|start' +
          '|test-exports)\\.ts$)',
      },
      to: { path: '(?!)' },
    },
    {
      name: 'api-holds-only-four-file-kinds',
      comment:
        'src/api/ holds four kinds of file: route.ts, definitions.ts, middlewares.ts and __tests__/. ' +
        'Route discovery reads definitions.ts, so a fifth kind is invisible to the routing layer and ' +
        'becomes a private convention nobody else follows. Per-route logic has a sanctioned seam — a ' +
        "MiddlewareFunction in middlewares.ts, wired through the definition's `middlewares: [...]` " +
        'array (src/api/store/customers/middlewares.ts is the reference). Logic that is not ' +
        'request-shaped belongs below the API layer: a module service, or a workflow when it spans ' +
        'modules.',
      severity: 'error',
      module: {
        path: '^src/api/(?!(?:.+/)?(?:route|definitions|middlewares)\\.ts$)(?!(?:.+/)?__tests__/)',
      },
      to: { path: '(?!)' },
    },
    {
      name: 'module-holds-only-known-file-kinds',
      comment: `
        A module is eight folders and four root files: models/, repositories/, services/,
        migrations/, __tests__/, loaders/, providers/, utils/, plus index.ts, database.config.ts,
        provider-declarations.ts and sync-providers.ts. Bootstrap reads index.ts and drizzle-kit
        reads database.config.ts, so a ninth folder or a fifth root file is invisible to both and
        becomes a private convention only its module follows. Every kind of code already has a
        home: a Drizzle table in models/, data access in repositories/, business logic in the
        service (a collaborator class the service keeps private, like ProductOptionService, is
        still services/), a pure helper a service consumes in utils/, provider DI registration in
        loaders/ and a provider that ships with the module in providers/. Logic that spans modules
        is not a module file at all — it is a workflow. See
        standards/rules/backend/modules/__docs__/modules.md.'
      `,
      severity: 'error',
      module: {
        path:
          '^src/modules/[^/]+/' +
          '(?!(?:index|database\\.config|provider-declarations|sync-providers)\\.ts$)' +
          '(?!(?:models|repositories|services|migrations|__tests__|loaders|providers|utils)/)',
      },
      to: { path: '(?!)' },
    },
    {
      name: 'module-tests-live-in-a-tests-folder',
      comment:
        "A module's tests live in __tests__/, never beside the file they cover. One place to look " +
        'holds whether the test is an integration test against Postgres or a pure-function test, ' +
        'and the folder is what tells a reader the difference between a module file and a file ' +
        'about a module file. __tests__/ may nest — __tests__/fixtures/ and loaders/__tests__/ are ' +
        'both fine.',
      severity: 'error',
      module: {
        path: '^src/modules/(?!(?:.+/)?__tests__/).*\\.test\\.ts$',
      },
      to: { path: '(?!)' },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
}
