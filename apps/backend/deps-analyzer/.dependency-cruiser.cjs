/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-module-internals',
      comment:
        'Only composition roots (container.ts, schema.ts, modules-definitions.ts) ' +
        "and a module's own files may import from src/modules/.",
      severity: 'error',
      from: {
        pathNot: '^src/modules/|^src/(container|schema)\\.ts$|^src/link-modules/modules-definitions\\.ts$|^tests/',
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
        'imported from within link-modules/ or schema.ts.',
      severity: 'error',
      from: {
        pathNot: '^src/(link-modules/|schema\\.ts$)',
      },
      to: {
        path: '^src/link-modules/(definitions/|modules-definitions\\.ts$)',
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
      name: 'no-temporal-in-workerd',
      comment:
        'The workerd bundle must not reach Temporal. @temporalio/worker pulls in ' +
        '@temporalio/core-bridge, a native addon workerd cannot load, so a stray import here is a ' +
        'broken deploy rather than dead weight. src/container.ts therefore takes the Temporal ' +
        'engine as an injected factory instead of importing the adapter, exactly as it takes its ' +
        'logger and dbProvider — this rule is what keeps that boundary deliberate rather than ' +
        'incidental. Reachability, not a direct import: the hazard is transitive.',
      severity: 'error',
      from: {
        path: '^src/index\\.workerd\\.ts$',
      },
      to: {
        path: '@temporalio/|^src/temporal/|^src/core/workflows/temporal-adapter\\.ts$',
        reachable: true,
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
   * file this is meant to catch. Same primitive as packages/frontend-conventions, same caveat: it
   * uses a documented feature in a way the docs never describe.
   */
  required: [
    {
      name: 'api-holds-only-four-file-kinds',
      comment:
        'src/api/ holds four kinds of file: route.ts, definitions.ts, middlewares.ts and __tests__/. ' +
        'Route discovery reads definitions.ts, so a fifth kind is invisible to the routing layer and ' +
        'becomes a private convention nobody else follows. Per-route logic has a sanctioned seam — a ' +
        "MiddlewareFunction in middlewares.ts, wired through the definition's `middlewares: [...]` " +
        'array (src/api/store/customers/middlewares.ts is the reference). Logic that is not ' +
        'request-shaped belongs below the API layer: a module service, or a workflow when it spans ' +
        'modules. src/api/index.ts is exempt — it is the backend-as-library composition root, not a ' +
        'route.',
      severity: 'error',
      module: {
        path: '^src/api/(?!index\\.ts$)(?!(?:.+/)?(?:route|definitions|middlewares)\\.ts$)(?!(?:.+/)?__tests__/)',
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
