'use strict'

/**
 * The structural rules the store and admin share, as dependency-cruiser rule builders.
 *
 * Both apps follow Bulletproof React, and until now both followed it by convention only — the
 * layout half of that standard has never been enforced anywhere, in either app. An agent building a
 * PR read the codebase for the local idiom, found five folders that already broke the vocabulary,
 * and produced a sixth. Prose lost to precedent because prose was all there was.
 *
 * Stated once, here, so the two apps cannot drift from each other or from the docs.
 */

/**
 * The folders a feature may contain.
 *
 * A feature is a folder of *these* folders and nothing else. Anything deeper than
 * `src/features/<feature>/<folder>/` is that feature's own business — `checkout/utils/payment/
 * adapters/stripe/` is fine — but the second level is a closed vocabulary, so every feature is
 * navigable the same way without opening it.
 *
 * `assets` and `stores` are listed ahead of any use: this is the vocabulary, not an inventory. A
 * feature that needs one should not have to amend a shared package to get it.
 */
const FEATURE_FOLDERS = ['api', 'assets', 'components', 'hooks', 'stores', 'types', 'utils']

/**
 * The shared layer — code that sits below every feature and may not know features exist.
 *
 * Top-level files (`env.ts`, `router.tsx`, `main.tsx`, `start.ts`, `routeTree.gen.ts`) are
 * composition roots rather than shared code, and are deliberately outside this list.
 */
const SHARED_FOLDERS = ['api', 'assets', 'components', 'hooks', 'lib', 'types', 'utils']

const APP_PATH = '^src/routes/'
const FEATURES_PATH = '^src/features/'
const sharedPathOf = (folders) => `^src/(?:${folders.join('|')})/`

/**
 * Two rules about where a file may *sit*, which dependency-cruiser has no direct way to express.
 *
 * The mechanism: a `required` rule is module-scoped — it selects modules with `module.path`, then
 * asserts each one has a dependency matching `to`. A `to.path` that can never match makes every
 * selected module fail, so the rule reads as "no module may exist at this path". No import edge is
 * involved, which is the whole point: a `forbidden` rule is evaluated per edge and therefore cannot
 * see a misplaced file that imports nothing.
 *
 * This uses a documented primitive in a way the docs never describe. Watch dependency-cruiser
 * issue #980 — it proposes warning on never-matching `to` patterns, which this depends on.
 */
function featureStructureRules(options = {}) {
  const folders = options.folders ?? FEATURE_FOLDERS
  const vocabulary = folders.join('|')

  return [
    {
      name: 'feature-folder-vocabulary',
      comment:
        `A feature's second level is a closed vocabulary: ${folders.join(', ')}. ` +
        'Put the file in one of those. Widening the vocabulary is a decision for ' +
        'packages/frontend-conventions, not for one app.',
      severity: 'error',
      // The trailing `/` is what makes this a rule about directories rather than files.
      module: { path: `^src/features/[^/]+/(?!(?:${vocabulary})/)[^/]+/` },
      to: { path: '(?!)' },
    },
    {
      name: 'no-loose-feature-files',
      comment:
        'A feature root holds folders, not files. A helper or constants file at the root is a file ' +
        'with no stated kind — move it into utils/ (or api/, types/, ...). Only an index.ts ' +
        "barrel, the feature's public face, may sit at the root.",
      severity: 'error',
      module: { path: `^src/features/[^/]+/(?!(?:${vocabulary})/|index\\.ts$)[^/]+\\.[^/]+$` },
      to: { path: '(?!)' },
    },
  ]
}

/**
 * Bulletproof React's one-way street: shared -> features -> app.
 *
 * Shared code knows nothing of features; nothing below the app layer knows about routes. Work that
 * spans two features is composed at the app level, which is why these are three specific rules
 * rather than one general "no upward imports" — the app layer is *supposed* to reach down.
 *
 * When shared chrome needs something from a feature, the answer is a slot the route fills, or the
 * component belonged to that feature all along. See `src/routes/` in either app for both shapes.
 */
function layerDirectionRules(options = {}) {
  const shared = sharedPathOf(options.sharedFolders ?? SHARED_FOLDERS)

  return [
    {
      name: 'shared-may-not-import-features',
      comment:
        'Shared code sits below every feature and may not reach up into one. Either the component ' +
        'belongs to that feature and should move into it, or it needs a slot that the route fills ' +
        'with the feature component.',
      severity: 'error',
      from: { path: shared },
      to: { path: FEATURES_PATH },
    },
    {
      name: 'shared-may-not-import-routes',
      comment: 'src/routes/ is the application layer. Nothing below it may import from it.',
      severity: 'error',
      from: { path: shared },
      to: { path: APP_PATH },
    },
    {
      name: 'features-may-not-import-routes',
      comment:
        'A feature may not import from src/routes/. Routes compose features, never the reverse — a ' +
        'feature needing route state takes it as a prop or reads the router directly.',
      severity: 'error',
      from: { path: FEATURES_PATH },
      to: { path: APP_PATH },
    },
  ]
}

module.exports = { FEATURE_FOLDERS, SHARED_FOLDERS, featureStructureRules, layerDirectionRules }
