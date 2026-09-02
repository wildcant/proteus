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
        'Only src/core/db/bignum.ts may import from bignumber.js. ' +
        'All other code should use the BigNumber wrapper. ' +
        'The exceptions are modules that must not pull drizzle-orm in through the wrapper: ' +
        'packages/http-schemas has no business depending on backend internals at all, and ' +
        'src/temporal/payload-converter.ts is bundled into the Temporal workflow sandbox, ' +
        'where the wrapper would drag drizzle-orm/pg-core along with it.',
      severity: 'error',
      from: {
        pathNot: '^src/core/db/bignum\\.ts$|^src/temporal/payload-converter\\.ts$|packages/http-schemas/',
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
