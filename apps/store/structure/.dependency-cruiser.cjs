const {
  apiLayerRules,
  entityStructureRules,
  featureStructureRules,
  layerDirectionRules,
} = require('@proteus/frontend-structure')

/** shared -> entities -> features -> routes. The admin has no entities layer and does not opt in. */
const entityRules = entityStructureRules()

/** The one directory allowed to know a payment gateway's name. See ADR 0010's client mirror. */
const STRIPE_ADAPTER_PATH = '^src/features/checkout/utils/payment/adapters/stripe/'

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
    {
      name: 'stripe-stays-in-its-adapter',
      comment:
        'The checkout depends on the StorePaymentAdapter contract, never on Stripe. Every Stripe ' +
        'symbol belongs under src/features/checkout/utils/payment/adapters/stripe/ — if the checkout, ' +
        'a component or a route needs something from the gateway, it belongs on the contract in ' +
        'src/features/checkout/types/payment.ts instead. Without this rule the abstraction rots ' +
        'the first time someone reaches for useStripe() one level up.',
      severity: 'error',
      from: { pathNot: STRIPE_ADAPTER_PATH },
      to: { path: '(^|/)node_modules/@stripe/' },
    },
    // HTTP stays behind the api layer, shared with the admin. See packages/frontend-structure.
    ...apiLayerRules(),
    {
      name: 'features-may-not-import-features',
      comment:
        'A feature may not import another feature. Code two or more features use is an entity: move it ' +
        'to src/entities/<entity>/. Work that spans two features is composed by the route. See ' +
        'docs/adr/0034-store-entities-layer-replaces-the-feature-graph.md.',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/' },
      to: { path: '^src/features/', pathNot: '^src/features/$1/' },
    },
    // shared -> features -> app, shared with the admin. See packages/frontend-structure.
    ...layerDirectionRules(),
    ...entityRules.forbidden,
    {
      name: 'navigation-only-from-routes',
      comment:
        'src/navigation/ is the flow map from the design file and the screen table that maps it onto the ' +
        'route tree. Only a route may ask it for link options; it passes them to its feature as props, so ' +
        'features, entities and shared components never know the route tree. See src/navigation/links.ts.',
      severity: 'error',
      from: { pathNot: ['^src/routes/', '^src/navigation/'] },
      to: { path: '^src/navigation/' },
    },
  ],
  required: [...featureStructureRules(), ...entityRules.required],
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
