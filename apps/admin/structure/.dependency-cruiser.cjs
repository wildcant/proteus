const { apiLayerRules, featureStructureRules, layerDirectionRules } = require('@proteus/frontend-structure')

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
    // HTTP stays behind the api layer, shared with the store. See packages/frontend-structure.
    ...apiLayerRules(),
    // shared -> features -> app, shared with the store. See packages/frontend-structure.
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
