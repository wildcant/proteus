/**
 * Which store feature may import which, as a directed acyclic graph.
 *
 * The key is a feature; the value is every other feature it may import from. Anything under
 * `src/features/` that is not itself and not in its list is an error. The shared layers
 * (`#/components`, `#/lib`, `#/api`, `#/env`) are always available and are not modelled here.
 *
 * The direction follows the domain, which is what makes it stable: a cart is meaningful with no
 * checkout, so `checkout -> cart` and never the reverse. When two features need the same thing,
 * the thing was never feature-specific — move it down to a shared layer instead of adding an edge.
 *
 * See docs/adr/0020-store-feature-graph-is-acyclic.md for the graph and the reasoning.
 */
const FEATURE_GRAPH = {
  cart: [],
  orders: [],
  address: [],
  auth: ['cart'],
  checkout: ['cart'],
  products: ['cart'],
  account: ['auth', 'orders'],
}

const DECLARED_FEATURES = Object.keys(FEATURE_GRAPH).join('|')

/** One rule per feature: it may reach itself and its declared dependencies, and nothing else. */
const featureGraphRules = Object.entries(FEATURE_GRAPH).map(([feature, allowed]) => ({
  name: `feature-graph-${feature}`,
  comment: `features/${feature} may import ${
    allowed.length ? allowed.map((dependency) => `features/${dependency}`).join(', ') : 'no other feature'
  }. Add the edge to FEATURE_GRAPH and ADR 0020, or move the shared code down to a shared layer.`,
  severity: 'error',
  from: { path: `^src/features/${feature}/` },
  to: {
    path: '^src/features/',
    pathNot: `^src/features/(${[feature, ...allowed].join('|')})/`,
  },
}))

module.exports = {
  forbidden: [
    {
      name: 'no-admin-schemas-in-store',
      comment: 'Store app must not import admin schemas.',
      severity: 'error',
      from: { path: '^src/' },
      to: { path: 'packages/http-schemas/src/admin/' },
    },
    {
      name: 'no-circular',
      comment: 'No circular dependencies allowed.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    ...featureGraphRules,
    {
      name: 'feature-graph-undeclared',
      comment:
        'A new feature must be declared in FEATURE_GRAPH before it may import another feature, so ' +
        'the graph is updated deliberately rather than grown by accident.',
      severity: 'error',
      from: { path: `^src/features/(?!(?:${DECLARED_FEATURES})/)` },
      to: { path: `^src/features/(?:${DECLARED_FEATURES})/` },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '\\.gen\\.ts$' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
}
