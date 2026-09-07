const { featureStructureRules, layerDirectionRules } = require('@proteus/frontend-conventions')

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-store-schemas-in-admin',
      comment: 'Admin app must not import store schemas.',
      severity: 'error',
      from: { path: '^src/' },
      to: { path: 'packages/http-schemas/src/store/' },
    },
    {
      name: 'no-tanstack-table-outside-data-table',
      comment: '@tanstack/react-table must only be imported from within the data-table component.',
      severity: 'error',
      from: { pathNot: '^src/components/data-table/' },
      to: { path: '@tanstack/react-table' },
    },
    {
      name: 'no-circular',
      comment: 'No circular dependencies allowed.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    // shared -> features -> app, shared with the store. See packages/frontend-conventions.
    ...layerDirectionRules(),
  ],
  required: featureStructureRules(),
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
}
