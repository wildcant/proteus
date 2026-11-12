# Store UI source of truth — FigCraft drives the storefront

Status: ready-for-agent

## Problem Statement

The storefront's look lives in code, not in a design file. Only the tokens (colour roles, font, type
sizes, three text styles) come from `Proteus.figcraft`; every component, screen, state and navigation
path is defined by hand in `apps/store`, on top of `@proteus/ui`, a shadcn-based kit shared with the
admin. A brand forking the blueprint cannot see or change the storefront's design without reading
code, the shared kit couples the storefront's look to the admin's, and nothing catches code drifting
away from the design.

The store's feature folders also import each other (17 import lines, 14 specifiers), held in check by
a hand-maintained feature graph (ADR 0020) that grows an edge every time two features share code.

## Solution

`Proteus.figcraft` becomes the source of truth for the storefront's UI, following the pattern the
sibling project Atope already runs:

- Every component set, every screen with its states, and every navigation path between screens is
  drawn in the design file, page by page in a layout that mirrors the code.
- Export scripts generate the store's styles (`cva()` variants), icon glyphs, brand marks, navigation
  map and the `DESIGN.md` frontmatter. Nothing generated is edited by hand.
- Each exporter has a `--check` that runs in the verify gate and fails when code and design drift.
- The store owns its primitives, built on `@base-ui/react`, and stops depending on `@proteus/ui`.
  Non-visual pieces both apps need move into a new package, `@proteus/ui-core`.
- The store gains an `entities` layer. Code a second feature needs moves into an entity, and features
  may no longer import features. The feature graph disappears.

The work is built in vertical slices on one feature branch, scheduled by a coordinator agent for speed,
and reviewed once when complete. The store stays visually and behaviourally unchanged throughout.

## User Stories

### Designing in FigCraft

1. As a designer, I want every storefront component drawn as a component set in the design file, so that I can change the store's look without touching code.
2. As a designer, I want a set's name to equal the code component's name, so that I can find the code for any set and vice versa.
3. As a designer, I want layer names to equal the `cva` export names, so that the exporter's mapping is predictable.
4. As a designer, I want text to go through component properties, so that instances carry real copy without detaching.
5. As a designer, I want only the variants the code actually uses in each set, so that the design file stays an honest picture of the store.
6. As a designer, I want the design file's pages to mirror the code's folders (`Foundation`, `flows`, `app/<group>`, `components/ui`, `components/store`, `entities/<entity>`, `features/<feature>`, `brand`), so that the structure itself tells me where each piece lives.
7. As a designer, I want a page created only when its first set needs it, so that the file has no empty scaffolding.
8. As a designer, I want a design-only `viewport` variant property on sets whose layout changes across breakpoints, so that I can draw the responsive behaviour without it becoming a code prop.
9. As a designer, I want `viewport` to accept `mobile`, `sm`, `md` and `lg`, drawing an intermediate value only where the set changes there, so that the store's existing `sm:` and `md:` behaviour is reproducible.
10. As a designer, I want to draw mobile first at 390 px and have larger viewports only add, so that the design follows the store's mobile-first rule.
11. As a designer, I want each screen drawn as one set with `state × viewport` variants, each frame bound to the matching `Viewport` mode, so that every state is visible at both widths.
12. As a designer, I want screens drawn in the `Light` theme only and checked in dark by switching the `Theme` mode, so that I don't maintain two copies of every frame.
13. As a designer, I want screens composed from instances of the component sets, so that a component change shows up on every screen.
14. As a designer, I want real copy from the `en` Lingui catalog in every drawing, so that the design reflects what shoppers read.
15. As a designer, I want seed data or plain placeholders instead of invented products, prices or copy, so that the design never promises what the store doesn't do.
16. As a designer, I want only `color/*` roles and existing tokens used in drawings, so that every value maps to the generated theme.
17. As a designer, I want a missing token raised as a gap for approval rather than added ad hoc, and once approved added in FigCraft and followed by a token export, so that the token set stays deliberate and the design file stays its source.
18. As a designer, I want a `flows` page with one section per flow, left to right, made of screen-set instances (the landing state plus every state where the flow branches) joined by arrows drawn as the FigCraft ops doc says, with events in SCREAMING_SNAKE_CASE and conditions in plain words, so that the whole navigation map is visible in one place.
19. As a designer, I want the flow map complete — every route, and every way out of a screen that the code has — so that the map can be checked against the router.
20. As a designer, I want header-level transitions (search, bag, account menu, market, theme) on a `Root` pseudo-screen, so that they aren't repeated on every screen.
21. As a designer, I want drawers and sheets drawn as states of the screen they cover, so that the flow map stays a map of screens.
22. As a designer, I want the icon set to live in the design file, including every glyph the store takes from Lucide today, so that icons are designed where everything else is.
23. As a designer, I want a `brand` page with an `export` section for the wordmark, favicon and touch icons, so that brand assets come from the design file too.
24. As a designer, I want the design rules written down for the design agent — structure mirrors the code; design in the screen; extract when a block repeats; promote when a second feature needs it (to `entities/<entity>` when it is that entity's display, else to `components/ui` or `components/store`); bring only what a screen needs; and the Plan before drawing, Build, Check and Hand over steps — so that every session draws the same way.
25. As a designer, I want FigCraft operating notes (driving the app, screen sets, flow arrows and events, export quirks), so that I and the agent don't relearn them.
26. As a designer, I want the agent to draw through the FigCraft app (not headless) so that I can watch, and to export through the headless CLI, so that drawing is visible and export is scriptable.
27. As a designer, I want the agent to open the file and check the current page before every write, and to save after every step, so that work isn't lost when the app reloads a file from disk.
28. As a designer, I want design files read and written only under the designs folder, so that FigCraft's sandbox is respected.
29. As a designer, I want the first drawing of every component and screen copied from the running store (dev server at 390 and 1440 px, light and dark), and where code and the running app disagree, what runs drawn and the disagreement recorded in the plan, so that the design starts as a faithful reproduction.
30. As a designer, I want the agent to ask before falling back to reading code when the store won't start, so that drawings aren't guessed from source.

### Exporting and checking

31. As a storefront developer, I want component sets exported as `cva()` variant files with Tailwind classes, so that the code's styling is generated from the design.
32. As a storefront developer, I want the page a set sits on to decide the folder its variants file goes into, so that I never configure output paths per set.
33. As a storefront developer, I want each generated variants file to sit beside its hand-written component in a folder per component, so that the generated and hand-written halves stay together.
34. As a storefront developer, I want the `viewport` property never to become a `cva` prop, with `mobile` values as base classes and each larger value's differences as its breakpoint prefix, so that responsive behaviour is CSS only.
35. As a storefront developer, I want screen sets and design-only sets never exported as styles, so that only reusable components produce code.
36. As a storefront developer, I want icon glyphs generated into the store's own icon component, so that an icon is a typed prop value, not an import from an outside library.
37. As a storefront developer, I want the brand exporter to write the favicon and touch icons into the store's public assets, so that brand marks never drift from the design.
38. As a storefront developer, I want the flow exporter to generate the navigation map from the `flows` page, so that a transition that isn't drawn can't be wired.
39. As a storefront developer, I want `DESIGN.md`'s whole frontmatter generated with a check — colors, typography, rounded and spacing from the token snapshot, components from the component snapshot — so that nothing in it is hand-written or can drift.
40. As a storefront developer, I want every exporter to share one FigCraft CLI wrapper, one snapshot folder and one config, so that adding an exporter is cheap.
41. As a storefront developer, I want machine-specific paths in a gitignored local config, so that the committed config works on any machine.
42. As a storefront developer, I want every exporter's `--check` to run in the verify gate, so that a stale export fails before review.
43. As a storefront developer, I want `check:flow` to fail when a flow target doesn't exist, a screen has no route, or a leaf route doesn't use its own screen, so that the map and the router agree.
44. As a storefront developer, I want layout and redirect routes skipped by `check:flow` because of their shape in the route tree, not because of an allowlist, so that no list needs maintaining.

### Navigation in code

45. As a storefront developer, I want each flow event to return TanStack link options, so that features render real `<Link>` anchors.
46. As a shopper, I want every navigation in the store to be a real link, so that I can middle-click, open in a new tab, and use a screen reader that announces links.
47. As a search engine crawler, I want server-rendered pages to contain `<a href>` links, so that I can discover every page.
48. As a shopper, I want links to keep TanStack's hover and viewport preloading, so that navigation stays fast.
49. As a storefront developer, I want events that follow a mutation (signed in, order placed) to navigate programmatically using the same link options, so that post-action redirects also go through the map.
50. As a storefront developer, I want routes to pass the flow's link options to feature components as props, so that features never know the route tree.
51. As a storefront developer, I want the `_main` layout to pass the `Root` links into the header as a prop, so that shared components import no navigation code.
52. As a storefront developer, I want the navigation module importable only by routes, so that the boundary is enforced.
53. As a storefront developer, I want a hand-written screen-to-route table, so that the design's screen names map to TanStack routes and params in one place.

### Store primitives and `@proteus/ui-core`

54. As a storefront developer, I want the store's primitives in its own `components/ui`, built directly on `@base-ui/react`, so that the store's look no longer depends on the admin's kit.
55. As a shopper, I want focus, keyboard, ARIA and portal behaviour unchanged after each primitive moves — same base-ui part, same props, same ARIA roles — so that the store works exactly as before.
56. As a storefront developer, I want `cn()`, the shared hooks, the toast manager and the non-visual route-modal pieces in `@proteus/ui-core`, so that both apps share behaviour without sharing looks.
57. As a storefront developer, I want ui-core to provide a prompt-hook factory that each app binds to its own styled alert dialog, so that the confirm-prompt mechanism is shared and its look isn't.
58. As a storefront developer, I want the store to render its own styled `Toaster` over the shared toast manager, so that `toast()` calls keep working anywhere.
59. As a storefront developer, I want the store to render its own route drawer over the shared `useRouteModal` and provider, so that the address drawers keep their behaviour with the store's look.
60. As an admin developer, I want `@proteus/ui` to re-export everything that moved to ui-core from its existing entry point, so that none of the admin's imports change.
61. As an admin developer, I want the admin-only pieces (`use-mobile`, the route-modal form, the keybound form, the route focus modal) to stay in `@proteus/ui`, so that nothing the store shouldn't use becomes reachable.
62. As an admin developer, I want the admin's diff to stay empty except for one dependency rule, so that this refactor can't break the admin.
63. As an admin developer, I want a structure rule forbidding the admin from importing `@proteus/design`, so that the store's design can't leak into the admin.
64. As a storefront developer, I want a structure rule forbidding the store from importing `@proteus/ui` once the last primitive moves, so that the old kit can't creep back.
65. As a storefront developer, I want `QuantityStepper` to become a primitive in `components/ui`, so that cart and products share it without either owning it.
66. As a storefront developer, I want a Storybook story for each primitive whose args come from the set's snapshot JSON, so that I can review every variant without seeding the backend.

### Entities and structure

67. As a storefront developer, I want an `entities` layer between shared code and features, so that code two features need has a home that isn't either feature.
68. As a storefront developer, I want an entity created only when two or more features use its code, so that the layer doesn't fill with speculative folders.
69. As a storefront developer, I want each entity to hold only the segments `api`, `data`, `model`, `lib` and `ui`, with no loose files, so that entities are as predictable as features.
70. As a storefront developer, I want imports to go only downward (shared, entities, features, routes), so that the layers never tangle.
71. As a storefront developer, I want entities never to import each other, features or routes, so that each entity stands alone.
72. As a storefront developer, I want one rule, "features may not import features", in place of the feature graph, so that the structure config stops growing an edge per shared need.
73. As a storefront developer, I want an entity's `api` segment allowed to call the generated client, as a feature's is, so that queries can move into entities unchanged.
74. As a storefront developer, I want each entity move to be a pure move with no behaviour or visual change, so that review is mechanical.
75. As a storefront developer, I want the entity rules opt-in in `@proteus/frontend-structure`, so that the admin's structure check doesn't change.
76. As a storefront developer, I want the customer's "me" queries, sign-out and password-reset request in a `customer` entity, so that account, checkout and auth reach them without importing each other.
77. As a storefront developer, I want sign-in, registration and password update to stay in the auth feature, so that code only one feature uses stays in that feature.
78. As a storefront developer, I want the cart, address, payment-method and order candidates confirmed against the glossary before they move, so that entity names match the domain language.

### Responsive behaviour

79. As a shopper on any device, I want layouts to switch by CSS, so that server-rendered pages are correct before JavaScript runs.
80. As a storefront developer, I want JavaScript viewport queries allowed only where CSS can't do the job or would be too troublesome, and the performance or UX cost is small, so that the rule is practical, not dogmatic.
81. As a storefront developer, I want the product gallery's mosaic/carousel `tabIndex` switch to keep its viewport query as an allowed case, so that it isn't rewritten for no gain.

### Docs

82. As a brand forking the blueprint, I want a brand-neutral `DESIGN.md` at the repo root in Atope's format, whose first paragraph names the design file as the source of truth with the page map and export commands, so that I understand the system before changing it.
83. As a brand forking the blueprint, I want a brand-neutral `PRODUCT.md` draft that says what a store built on this blueprint is for, approved before anything relies on it, so that design decisions have a stated purpose.
84. As a storefront developer, I want `docs/components.md` in the store describing every component and the "From FigCraft to code" contract, so that I know what's generated and what's hand-written.
85. As a designer, I want a `docs/design` set (colour roles with contrast ratios, brand rules, brand marks, checklist, FigCraft ops), so that the design rules are written down.
86. As a storefront developer, I want an ADR for the entities layer superseding ADR 0020, and an ADR for store-owned primitives with ui-core, so that future readers know why the structure looks like this.
87. As a storefront developer, I want the glossary to define Cart, Customer, Address, Order and Payment Method, written first in the inventory and approved by the owner before the entity list is final, so that entities, screens and events use agreed words.

### Process and parity

88. As the project owner, I want the whole feature built on one feature branch and reviewed once, when it is complete, so that no tokens go into interim reviews, interim merges or rework.
89. As the project owner, I want a coordinator agent scheduling the work for speed and efficiency, running independent work in parallel and ordering the rest so that every file is moved or rewritten once, straight to its final place and form, so that no effort goes into temporary states.
90. As the project owner, I want the work to block on me only for decisions that are mine: the glossary terms, the `PRODUCT.md` draft, token gaps, deviations from Atope, a settled decision that turns out impossible, and an admin diff that isn't empty, so that everything else runs without waiting.
91. As the project owner, I want before/after screenshots at 390 and 1440 px in light and dark for every slice, kept outside git under the designs folder per slice, with each difference listed and justified in the hand-off, so that "no visual change" is checked, not assumed.
92. As the project owner, I want keyboard and focus checked by hand on each slice's screen (Tab, Shift+Tab, Escape, arrows), so that behaviour parity is verified.
93. As the project owner, I want the plan file in the design folder updated at the end of every session with what's done, the next slice and open questions, so that the next session picks up where the last stopped.
94. As the project owner, I want every deviation from Atope's pattern listed with its reason and approved before it's acted on, so that the two projects stay comparable.
95. As the project owner, I want conventional commits, nothing ever pushed to `main`, and merging left to me, so that `main` only changes when I decide.
96. As the project owner, I want the gates run per change — store-only work runs Biome with write on the store sources and the store typecheck; anything touching packages or scripts runs the full verify — and the Playwright suites only offered, never run unprompted, so that each change is checked at the right cost.
97. As the project owner, I want code that becomes unused deleted as part of the change that orphaned it, with the unused-code check passing, so that dead code never accumulates.
98. As the project owner, I want generated files (`*.gen.*`, `*.variants.ts`, icon glyphs, snapshots), `.scratch/` tickets and the Lingui catalogs (changed only through `lingui extract`) never hand-edited, so that generated and owned sources stay trustworthy.

## Implementation Decisions

### Packages

- **`@proteus/design`** replaces `@proteus/design-tokens` by rename. It holds the token, component, icon,
  brand, flow and `DESIGN.md`-frontmatter exporters, one shared FigCraft CLI wrapper, one snapshot
  folder, one committed config plus a gitignored local config for machine paths. Only the store depends
  on it. The CLI takes `--config`, so a future admin design file gets its own config.
- **Exporter shape** is the tokens exporter's: committed snapshot, pure build function from snapshot to
  generated source, `--export` to refresh the snapshot through the CLI, `--check` to compare generated
  source with what's committed. Every `--check` runs in the verify gate.
- **Exporter outputs** go into the store: variants files beside their components, icon glyphs into the
  store's icon component, brand assets into public assets, the flow map into the store's navigation
  module. No exporter writes into another package. `packages/icons` is deleted in the finishing slice.
- **`@proteus/ui-core`** is non-visual and depends on `@base-ui/react`. It holds `cn()`, the shared hooks
  except `use-mobile`, the toast manager and `toast()` API, `useRouteModal`, the route-modal provider and
  context, the router type augmentation, and a prompt-hook factory that takes the app's prompt
  renderer. `@proteus/ui` imports these and re-exports them from its existing entry, binding the factory
  to its own alert dialog so the admin's `usePrompt` keeps working. The store imports ui-core directly.
- **`@proteus/ui`** keeps every visual component plus `use-mobile`, the route-modal form, the keybound
  form and the route focus modal. The admin keeps using it unchanged.
- **No duplication.** Each piece lives in exactly one of ui-core or `@proteus/ui`; nothing is copied
  between them. ui-core's entry point is a barrel, allowed by ADR 0028 because it is a published
  package boundary.
- **Lucide.** Store primitives keep importing `lucide-react` until the icons slice replaces every glyph
  with the store's generated icon component; the finishing slice removes `lucide-react` from the store's
  dependencies.
- **Drawer animation.** The store's drawer and route drawer reproduce the keyframes and data-attribute
  variants the store gets today from the shared kit's generated shadcn stylesheet, so that the stylesheet
  import can be removed at the finish with no visual change.

### Components exporter

- Port of Atope's components script: component sets become `<name>.variants.ts` with `cva()` and
  Tailwind classes; layer-to-export mapping, slots, the not-exported list, design-only sets and screen
  sets follow Atope.
- The page decides the folder, per the page map: `components/ui` → store primitives,
  `components/store` → store-wide blocks, `entities/<entity>` → that entity's `ui` segment,
  `features/<feature>` → that feature's components. Each component has its own folder holding the
  hand-written component and the generated variants file.
- **Viewport rule:** a set may have a design-only `viewport` property with values `mobile`, `sm`, `md`,
  `lg`, matching Tailwind's default breakpoints (`sm` 40rem, `md` 48rem, `lg` 64rem). It never becomes a
  `cva` prop. `mobile` values become base classes; each larger value emits only
  the classes that differ from the next value down, under its breakpoint prefix. Intermediate values are
  drawn only where the set changes there. (Amends the original `mobile`/`desktop`-only rule, which could
  not reproduce the store's 65 `sm:` and 5 `md:` uses.)

### Navigation

- Port of Atope's flow script and navigation module, adapted for the web (a chosen deviation): each
  event of a screen yields TanStack link options (`to`, `params`, `search`) instead of an imperative
  push. Features render `<Link>` with them. Events after a mutation pass the same options to
  `navigate`. Building link options is pure and safe during SSR.
- A hand-written screen table maps each design screen to a route and its params.
- Routes obtain the link options and pass them to feature components as props. The `_main` layout passes
  the `Root` pseudo-screen's links into the header. The navigation module may be imported only by
  routes, enforced by a dependency-cruiser rule in the store's structure config.
- Drawers and sheets are states of the screen they cover.
- `check:flow`: every target exists, every screen has a route, every leaf route uses its own screen.
  Layout and redirect routes are excluded by their shape in the route tree.

### Store structure

- New `entities` layer: shared → entities → features → routes. Entity segments: `api`, `data`, `model`,
  `lib`, `ui`; no loose files. Entities import no entity, feature or route; shared imports no entity.
- `@proteus/frontend-structure` gains an opt-in `entityStructureRules()` and widens `apiLayerRules()` so
  an entity's `api` may call the generated client. The admin doesn't opt in.
- An entity exists only when two or more features use its code. The feature graph and its
  undeclared-feature rule are replaced by one rule: features may not import features. A new ADR
  supersedes ADR 0020.
- **`customer` entity** (confirmed): the "me" queries (`useMe`, `useSuspenseMe` and their query
  options), `useLogout` and `useRequestPasswordReset`. Sign-in, registration and password update stay in
  the auth feature.
- **Remaining candidates**, confirmed in the inventory against new glossary terms: `cart` (the cart
  queries and mutations), `address` (address queries and the address-lines display), `payment-method`
  (saved payment methods, the saved-card row, expiry formatting), `order` (order queries, fulfillment
  labels).
- **`QuantityStepper`** becomes a store primitive, not part of a cart entity: it holds no cart logic.
  It moves once, straight into its final primitive form.
- Entity moves are pure moves: no behaviour or visual change rides along with them.
- "Features may not import features" switches on, and the feature graph is deleted, once the last
  cross-feature import is gone. Until then the feature graph stays as it is; no interim edges are added
  or rewritten.
- After every change, the store's structure check and the unused-code check pass, and the admin's
  structure check is unchanged.

### Responsive

- Layout changes across breakpoints are CSS. JavaScript viewport queries are allowed only where CSS
  can't express the change or would be too troublesome, and the performance or UX cost is small. The
  product gallery's `tabIndex` switch is such a case and stays. `prefers-color-scheme` queries are not
  viewport queries and are unaffected. The store never uses `use-mobile`.

### Docs and glossary

- `DESIGN.md` at the repo root in Atope's format (frontmatter: colors, typography, rounded, spacing,
  components; sections: Overview with a creative north star, Colors, Typography, Layout, Elevation &
  Depth, Shapes, Components, Do's and Don'ts with Named Rules). The whole frontmatter is generated:
  colors, typography, rounded and spacing from the token snapshot; components from the component
  snapshot, one entry per exported set variant with its fill, text colour, text style and size as token
  references (Atope writes this block by hand). The prose is hand-written. Brand-neutral. Its first
  paragraph names the design file as the source of truth and gives the page map and export commands.
- `PRODUCT.md` draft, brand-neutral, approved before use.
- The store's components doc, and the `docs/design` set (colour, brand rules, brand marks, checklist,
  FigCraft ops), ported from Atope with only stack-forced changes. The design agent definition is ported
  too, keeping its "Structure mirrors the code", screen sets, `flows` page, "design in the screen,
  extract, promote, bring only what a screen needs", "Plan before drawing", "Build", "Check" and "Hand
  over" sections.
- The glossary gains Cart, Customer, Address, Order and Payment Method before the entity list is
  finalised. "Feature" in the glossary keeps its access-control meaning; feature folders are an
  implementation word and stay out of it.
- Two ADRs: the entities layer (supersedes 0020), and store-owned primitives over ui-core.

### Storybook

- `@storybook/react-vite` in the store, added with the components exporter. Each primitive gets a story
  whose default args and options come from its set's snapshot JSON, imported from `@proteus/design`
  (Atope keeps the JSON in the app; here it stays in the one snapshot folder).

### Slices and order

The slices are units of work, not review stops. Everything lands on one feature branch and is reviewed
once, when the feature is complete. A coordinator agent schedules the slices: independent ones run in
parallel, and the order is chosen so that every file is moved or rewritten once, straight to its final
place and form. The only waits are for owner decisions (the glossary terms, the `PRODUCT.md` draft,
token gaps, deviations from Atope, a settled decision that proves impossible, an admin diff that isn't
empty).

1. **Inventory.** Written to the plan file. It contains:
   - the glossary terms Cart, Customer, Address, Order and Payment Method, for owner approval before the
     entity list is final;
   - every route, its screen set (named like the feature component the route renders) and its states,
     each with the code that produces it — loading, empty, error, guest vs signed in, validation, drawer
     open; states not found in code become questions for the owner;
   - every component with the variants its call sites use;
   - each entity candidate confirmed or rejected against the glossary, with what moves;
   - the flows, each as a sentence and a path, with events in SCREAMING_SNAKE_CASE and conditions in
     plain words: browse → product → bag → checkout → payment → confirmation; sign up / log in / reset
     password; account → addresses → edit; orders → detail; header-level transitions on `Root`;
   - token gaps (values the code uses that no token expresses), none added;
   - the deviations from Atope with reasons;
   - anything that makes a settled decision impossible.
2. **Scaffold**: the package rename, ui-core, the ported design agent and docs, `DESIGN.md` with
   generated frontmatter, the `PRODUCT.md` draft, the admin rule.
3. **Components exporter** with Storybook.
4. **Entities**: the structure rules and the ADR superseding 0020, then the entity moves.
5. **Primitives**: `Button`; forms (`Field*`, `Input`, `Label`, `Checkbox`, `RadioGroup`,
   `NativeSelect`); `Drawer`, the route drawer and the alert-dialog prompt; `Skeleton`; toast; `Tooltip`,
   `DropdownMenu`, `Collapsible`, `Accordion`; `QuantityStepper`.
6. **Store blocks, entity and feature components, then screens.**
7. **`flows` page and flow exporter.**
8. **Icons and brand.**
9. **Finish**: drop `@proteus/ui` and `lucide-react` from the store, the kit's stylesheet import, the
   `@source` line and every shadcn variable repoint nothing reads; delete `packages/icons`; add the rule
   forbidding the store from importing `@proteus/ui`; every `--check` in the verify gate.

A primitive is done when its set is drawn matching the running store with only the used variants, the
variants are exported, the store component sits on `@base-ui/react` using the generated variants and
ui-core's `cn`, every store import is swapped, nothing in the store uses the shared kit's version, what
became unused is deleted, `DESIGN.md` (Components) and the components doc describe it, the screenshots
and keyboard pass are done, and the gates pass.

### Process rules

- **FigCraft.** Draw through the FigCraft app so the owner can watch; export through the headless CLI.
  Open the file, then list and select the page before every write. Save after every step. FigCraft reads
  and writes only under the designs folder. Machine paths go only in the gitignored local config.
- **Running store first.** The first drawing of anything copies the running store (dev server, 390 and
  1440 px, light and dark). If the store won't start, ask before falling back to code. When code and app
  disagree, draw what runs and record the disagreement in the plan file.
- **Gates.** Store-only changes: Biome with write on the store sources, then the store typecheck.
  Anything touching packages or scripts: the full verify. Playwright suites are offered, never run
  unprompted.
- **Git.** Conventional commits. Never push to `main`; never merge — the owner merges.
- **Never hand-edit** generated files (`*.gen.*`, `*.variants.ts`, icon glyphs, snapshots), `.scratch/`
  tickets, or the Lingui catalogs (only through `lingui extract`).
- **Screenshots** live outside git, under the designs folder in one folder per slice; differences are
  listed and justified in the plan file.
- **Hand-off.** Every session ends by updating the plan file: what's done, the next slice, open
  questions.

## Testing Decisions

- A good test exercises external behaviour through the highest seam available, and every new or changed
  test names the behaviour change it catches. An assertion that cannot fail is not a test.
- **Exporter build functions** are the main seam: one test file per exporter (components, icons, brand,
  flow, `DESIGN.md` frontmatter), feeding a fixture snapshot into the pure build function and asserting
  the generated source. No FigCraft CLI runs in tests. `--check` reuses the build function and isn't
  tested separately. Prior art: the tokens package's build test. Cases worth covering in the components
  exporter: layer-to-export mapping, slots, not-exported and screen sets skipped, page-to-folder
  mapping, and the viewport rule (base classes from `mobile`, only differing classes per breakpoint, no
  `viewport` prop).
- **`check:flow`** is tested through the flow exporter's build test with a fixture route list: a missing
  target, a screen with no route, a leaf route without its screen, and a layout route that must be
  skipped.
- **Structure rules** are tested through the store's existing `check:structure` run. Each new rule is
  proven once by planting a violation (a feature importing a feature, an entity importing an entity, a
  loose file in an entity, shared importing an entity), seeing the check fail, and reverting. The
  admin's structure check, run unchanged, is the regression for the admin. `entityStructureRules()`
  and the widened `apiLayerRules()` get no unit tests of their own.
- **Store behaviour** gets no new unit tests per primitive. Parity is checked by screenshots and the
  keyboard pass; existing store tests and the typecheck stay green. The Playwright journeys are offered,
  never run unprompted.
- Storybook is a review surface, not a test seam.

## Out of Scope

- The admin's UI, its use of `@proteus/ui`, and any admin design file.
- Visual changes. Every first drawing reproduces the running store; a redesign is separate work.
- New tokens, unless a gap is raised and approved.
- Moving the admin off Lucide or `@proteus/ui` primitives.
- Rewriting the product gallery's viewport query.
- Story-based or visual-regression test tooling.

## Further Notes

- Depends on the tokens exporter PR (#168) being merged; the feature branch starts from `main` after it.
- Builds on `.scratch/store-design-system/spec.md`, which established the token layer and type roles
  this work keeps.
- Deviations from Atope so far: link options instead of imperative navigation (web links, SSR, SEO);
  the `viewport` property takes breakpoint values beyond mobile/desktop (reproduce the store); the
  snapshot lives in the design package, not the app (one design package); Storybook on Vite (web stack).
  The inventory lists the rest.
- The plan and hand-off file lives at `~/designs/proteus/plan-ui-source-of-truth.md`, outside the repo.
- Never name the reference brand anywhere; the blueprint stays brand-neutral.
- **Read first.** Atope: `DESIGN.md`, `PRODUCT.md`, `AGENTS.md` (Architecture) and its dependency-cruiser
  config, the designer agent, `docs/design/*`, `docs/components.md`, the four exporters and their shared
  FigCraft lib, the navigation-flow plan and the navigation module, and every page of `Atope.figcraft`.
  Proteus: `AGENTS.md`, the store's `AGENTS.md` and the standards it points to, `CONTEXT.md`, the tokens
  package README, `@proteus/frontend-structure`, the store's structure config, ADR 0020, `packages/ui`,
  `packages/icons`, and the store's routes, features, components, stylesheet and Lingui catalogs.
