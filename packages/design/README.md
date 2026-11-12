# @proteus/design

The exporters that turn the FigCraft design file into code: the Tailwind v4 theme (`tokens`), the
store's component variants (`components`), the frontmatter of the repo's `DESIGN.md`
(`design-md`), the store's navigation map (`flow`), its Icon glyphs (`icons`) and its favicon and
touch icons (`brand`). Everything lives in this folder: the exporters, their one config, the one FigCraft
snapshot (`figcraft/`), and the generated CSS. Generated files are never edited by hand.

Each exporter has the same shape: a pure build from the committed snapshot to generated source,
`--export` to refresh the snapshot through FigCraft's headless CLI (`src/figcraft.ts`, shared), and
`--check` to compare the generated source with what is committed. One CLI runs them all:
`node src/cli.ts <exporter> [--export] [--check] [--config design.json]`.

```css
/* apps/<app>/src/styles.css, after `@import "tailwindcss"` */
@import "@proteus/design/tokens.css";
```

## Commands

Run them from this folder, or with `pnpm --filter @proteus/design run <script>`.

| Script | What it does |
|---|---|
| `tokens:export` | Exports the variables and text styles (`figcraft/*.json`), then regenerates `tokens/`. Needs FigCraft's CLI. |
| `tokens` | Regenerates `tokens/` from the committed snapshot. No FigCraft needed. |
| `components:export [Set…]` | Exports every component set the page map exports (`figcraft/components/<Set>.json`), or only the named ones, then regenerates the variants files. Needs FigCraft's CLI. |
| `components` | Regenerates every `<name>.variants.ts` from the committed snapshot. |
| `design-md` | Rewrites the frontmatter of `DESIGN.md` from both snapshots; the prose is left alone. |
| `flow:export` | Exports the screen sets and the `flows` page (`figcraft/flows.json`), then regenerates the store's `src/navigation/flow.gen.ts`. Needs FigCraft's CLI. |
| `flow` | Regenerates `flow.gen.ts` from the committed snapshot. |
| `icons:export` | Exports each variant of the `Icon` set as SVG (`figcraft/icons/<name>.svg`), then regenerates the store's `icon.glyphs.tsx`. Needs FigCraft's CLI. |
| `icons` | Regenerates `icon.glyphs.tsx` from the committed SVGs. |
| `brand:export` | Exports each frame of the `brand` page's `export` section into the store's `public/` and records them in `figcraft/brand.json`. Needs FigCraft's CLI. |
| `tokens:check`, `components:check`, `design-md:check`, `flow:check`, `icons:check`, `brand:check` | Exit 1 when a generated file is not what the snapshot produces, or the exporter reports a problem (`flow:check` is also check:flow; `brand:check` finds a brand file changed or missing since its export). Write nothing; `scripts/verify.sh` runs them. |
| `test` | The exporters' tests. |

To change a token or a component, change it in the design file, run its `:export` and `design-md`,
and commit `figcraft/` with what they generated.

## Components

Each component set becomes `<name>.variants.ts` with one `cva()` per styled layer (a port of the sibling
project Atope's exporter; the mapping is at the top of
`src/components/build.ts`). The page the set sits on decides the folder, under `components.root`:

| Page | Folder |
|---|---|
| `components/ui`, `components/store` | `components/<slice>/<name>/` |
| `entities/<entity>` | `entities/<entity>/ui/<name>/` |
| `features/<feature>` | `features/<feature>/components/<name>/` |

The hand-written component sits in the same folder. Never exported: screen sets (pages `app/*` and
`flows`, or a description starting "Screen set"), `Reference · …` frames, sets on
`components.skippedPages`, and the sets on `components.notExported`.

A set may have a design-only `viewport` variant property with the values `mobile`, `sm`, `md`, `lg`
(Tailwind's default breakpoints). It never becomes a `cva` prop: the `mobile` variant gives the base
classes, and each larger one only the classes that differ from the next one down, under its prefix
(`md:flex-row`). Draw an intermediate value only where the set changes there.

A set may also have a design-only `interaction` variant property with the values `rest`, `hover`,
`focus-visible`, `active`, `disabled`; draw `rest` and only the states that look different. It never
becomes a `cva` prop either: `rest` gives the base classes, and each other value only the classes that
differ from `rest` at the same viewport, under its Tailwind variant (`hover:bg-ink/80`,
`disabled:opacity-50`). On a layer inside the component the state is the component's, read through a
named group: the root gets `group/<set-name>` and the layer `group-hover/<set-name>:`. Breakpoint and
state compose (`md:hover:`). Where a Base UI part marks its state with a data attribute instead, map the
value in `components.interactionPrefixes` (`{ "Checkbox": { "disabled": "data-disabled" } }`).

Read beyond tokens: layer opacity is `opacity-*`; a stroke drawn transparent (`#RRGGBB00` or paint
opacity 0) is `border-transparent`, so variants keep a bordered one's box; an auto layout whose in-flow
children all fill across it is `items-stretch`, and those children carry no `self-stretch`; a vector
draws in `currentColor`, so its Theme colour is `text-*` on its layer, or on the slot that holds it. A set
on `components.inline` has an `inline-flex` root (a button that sits in a sentence); every other root is
`flex`. A text style's decoration and underline offset are part of the style (`type/link`): setting a
decoration on a text layer detaches its style in FigCraft.

Only token-bound values become classes. A raw colour, an unbound padding or a layer kind the build
does not map stops the build with the layer named, so the design is fixed rather than guessed.

## DESIGN.md

`design-md` generates the whole frontmatter in Atope's format: `colors` (each Theme role in the first
Theme mode), `typography` (each `type/*` style at the base viewport), `rounded` (`radius/*`),
`spacing` (`space/*`), and `components`, one entry per variant of each exported set (the `viewport`
read at `mobile`) with its fill, text colour, text style and token-bound size as references
(`{colors.accent}`). `name` and `description` come from `designMd` in the config.

## Flow

The `flows` page is the navigation map (how to draw it: `docs/design/figcraft-ops.md`, "Flows: arrows
and events"). Each section is a flow; each arrow group (pluginData `kind: "flowEvent"`, or named
`EVENT · From/state → To/state`) is a transition. The screens are the screen sets on `app/*` pages,
plus the `Root` pseudo-screen set on `flows` (the header-level transitions). Their variants are named
`state=…, viewport=…` in any order; only `state` is read. `flow` writes `flow.gen.ts`: per screen, per
event, the transitions drawn, including those that stay on their screen, since on the web they change
the URL. Without a `flows` page it writes an empty map, which is valid.

`flow:check` also holds the map, the store's hand-written screen table (`src/navigation/screens.ts`)
and the route tree (`routeTree.gen.ts` and the route files) to each other. It fails when:

- a target on the map has no entry in the screen table;
- a screen on the map has no route there, or an entry names a route or a state that doesn't exist;
- a route is no screen's, or a leaf route doesn't render the screen its entry names, itself or through
  a layout above it (a drawer is a state of the screen it covers; a layout that renders a screen, as
  checkout and the address book do, is that screen's page).

A route is skipped by its shape alone, no list: a component that renders only `<Outlet />`, or no
component and a redirect in `beforeLoad`. While the map has no flows there is nothing to check.

## Icons

Each variant of the `Icon` set, named `name=<kebab-case>`, one colour, clipped to its 24 × 24 frame,
becomes one entry of `glyphs` in `icon.glyphs.tsx`: the inside of the `<svg>` as JSX, its colour
`currentColor`, its clip ids prefixed with its name. The store's hand-written `icon.tsx` beside it
draws the frame and takes `name: IconName`. A second colour, another frame size or an element the
build doesn't map stops the build with the glyph named. Without the set, no file is generated.

## Brand

Each direct child frame of the `export` section on page `brand` is one image file
(`docs/design/brand-marks.md`): its pluginData `{kind: "brandExport", file, px}` names the file inside
`brand.output` (`.png` or `.svg`) and its pixel size; the frame is named like the file and sized at 1×.
`brand:export` writes the files through FigCraft's CLI, removes the ones no frame exports any more,
and records each file's size and hash in `figcraft/brand.json`. There is nothing to regenerate:
`brand:check` says whether each recorded file is still there, at its size and unchanged. Without a
`brand` page nothing is exported.

## Set up this machine

The `:export` scripts need to know where the design file and FigCraft's CLI are. Those paths are personal,
so they live in `design.local.json` beside the config, which is gitignored:

```json
{
  "file": "~/designs/<project>/<Project>.figcraft",
  "cli": "~/<path to FigCraft>/target/release/figcraft-cli"
}
```

`~` expands to your home folder. Each field is optional:
- `FIGCRAFT_FILE` and `FIGCRAFT_CLI` in the environment override them.
- Without a `cli`, `figcraft-cli` must be on your PATH.

The builds and the `:check` scripts read only the committed snapshot. They need none of this, which
is why CI runs them as is.

## Switch to another design file

For example, when a fork of this blueprint gets its own design:

1. Check the new file follows the [naming rules](#naming-rules-for-the-design-file). It needs:
   - a Theme collection with the modes `theme.modes` lists (`Light`, `Dark`);
   - a Viewport collection with the modes `viewport.modes` lists (`Mobile`, `Desktop`), or no
     `viewport` in the config;
   - every `type/*` text style's font bound to a `font/*` variable.
   If the file names its collections or modes differently, change `tokens.theme` and
   `tokens.viewport` in `design.json` to match.
2. Point `file` in `design.local.json` at the new file.
3. Run `pnpm --filter @proteus/design run tokens:export`, then `components:export` and
   `design-md`. They replace `figcraft/`, `tokens/`, the variants files and the frontmatter.
   If the file breaks a rule, the export stops and names the variable or style.
4. Check what the apps use that the new file no longer defines. The generated CSS only declares what
   the file has: a role that is gone (say `ink-subtle`) leaves its `text-ink-subtle` classes without a
   colour, and Tailwind doesn't warn. Search the apps for the roles that left, and repoint the app
   stylesheet's own aliases (for example `--primary: var(--ink)`) at the new roles.
5. Commit `figcraft/` and everything generated together.

## Use it in another project

1. Copy this folder to `packages/design` in the new monorepo. Rename the package to the
   project's scope (`@<project>/design`) in three places: `package.json`, the app's dependency
   and the app's import.
2. Create `design.local.json` (see [Set up this machine](#set-up-this-machine)) and follow
   [Switch to another design file](#switch-to-another-design-file).
3. Add `"@<project>/design": "workspace:*"` to the app's dependencies, and
   `@import "@<project>/design/tokens.css";` to its stylesheet, right after the Tailwind
   imports.
4. Exclude `figcraft/` from the repo's formatter (it is FigCraft's output, rewritten on every export).
   Here, that's `!packages/design/figcraft` in `biome.json`.
5. Point `components.root` at the app's `src`, `designMd.output` at its `DESIGN.md`, and `flow`,
   `icons` and `brand` at its navigation module, Icon folder and public folder, or drop those
   sections. `flow:check` reads a TanStack Router route tree. A second app with its own design file
   gets its own config: `--config`.
6. Optionally, add the `:check` scripts and `test` to the project's verification gate.

The app keeps what is not a token:
- `@font-face` rules, because the font files are app assets. Use the family name the design file
  uses, since `--font-<key>` refers to it.
- How the colours are wired into a component library, for example shadcn's `--primary: var(--ink)`.

## Naming rules for the design file

The generator reads variables and text styles by name. It uses the same naming as Atope's exporter,
so one design-file convention serves every project.

| In FigCraft | Becomes |
|---|---|
| Theme collection, `color/<name>` (one value per mode) | `--<name>` per mode, plus `--color-<name>: var(--<name>)` in `@theme`, so `text-<name>`, `bg-<name>/40` and the rest work, and a mode swaps only the raw variable |
| `palette/<ramp>/<step>` | The raw colours the roles alias. Not in CSS unless `paletteInTheme` is set; in the TS output |
| `font/<key>` | `--font-<key>` (the family, then a generic fallback) |
| `space/<key>` | `space/1` is `--spacing`, Tailwind's step; a numbered key that is that many steps (`space/4` = 16) is implied, any other key is `--spacing-<key>` |
| `radius/<key>` | `--radius-<key>`; 9999 or more is `calc(infinity * 1px)`, Tailwind's own full radius |
| `weight/<key>` | `--font-weight-<key>` |
| `text/<key>/size`, `text/<key>/leading` (px) | `--text-<key>` and `--text-<key>--line-height` as Tailwind writes it, a ratio (`calc(1.25 / 0.875)`) |
| `tracking/<key>` (percent of the font size) | `--tracking-<key>` in em |
| `leading/<key>` (unitless) | `--leading-<key>` |
| `breakpoint/<key>` (px) | `--breakpoint-<key>` in rem |
| `duration/<key>` (ms) | `--transition-duration-<key>`, which `duration-<key>` reads |
| `ease/<key>` (a string) | `--ease-<key>` |
| Effect style `shadow/<key>` (drop and inner shadows) | `--shadow-<key>`; a colour bound to a `color/*` role is `var(--<role>)` |
| `stroke/<key>` | TS output only |
| Viewport collection, any number (one value per viewport mode) | Responsive: `clamp()` between the first and last mode (`fluid`), or overridden by `min-width` (`steps`). With `fluid`, a mode between the two is a drawing mode: it must hold the interpolated value at its width, or the build stops |
| Text style `type/<name>` | Class `type-<name>`: family, size, weight, line height, letter spacing and case |
| Any other name | Kept in the TS output under `other`, never dropped |

For text styles:
- The font family must be bound to a `font/*` variable; the generator stops with an error otherwise.
- Bind the size (and line height, if in px) to `type/<name>/size|leading` variables. Put those in the
  Viewport collection to make them responsive. Or bind them to a `text/<key>/size` and its
  `text/<key>/leading`: the class then reads `var(--text-<key>)` and its line height, so the style and
  Tailwind's `text-<key>` are the same values.
- The weight comes from the style name (Regular 400 … ExtraBold 800).
- A percent line height becomes unitless (90 % → `0.9`).

Colours may have alpha: they export as `rgb(r g b / a)`, the alpha as designed rather than rounded to 8 bits.

## Config: `design.json`

Committed and shared, one section per exporter. The machine paths are in `design.local.json`, not here.

```jsonc
{
  "snapshot": "figcraft",                             // the committed export, shared by every exporter
  "tokens": {
    "output": { "css": "tokens/tokens.gen.css" },     // add "ts": "tokens/tokens.gen.ts" for raw values in code
    "theme": {
      "collection": "Theme",
      "modes": [                                      // the first mode goes on :root
        { "mode": "Light", "selector": ":root" },
        {
          "mode": "Dark",
          "selector": ":root[data-theme=\"dark\"]",
          "media": { "query": "(prefers-color-scheme: dark)", "selector": ":root:not([data-theme=\"light\"])" }
        }
      ]
    },
    "viewport": {                                     // optional
      "collection": "Viewport",
      "modes": [{ "mode": "Mobile", "width": 375 }, { "mode": "Desktop", "width": 1440 }],
      "scale": "fluid"                                // or "steps": each later mode applies from its width up
    },
    "textStyles": { "prefix": "type-", "form": "doubled" }, // or "utility" (default); both take variants
    "paletteInTheme": false,
    "rootFontSize": 16
  },
  "components": {                                     // optional
    "root": "../../apps/store/src",                   // the page map's folders are under it
    "notExported": { "Icon": "exported by the icons exporter" }, // set -> why
    "skippedPages": [],                               // besides app/* and flows
    "notStyledLayers": {},                            // "Set › layer" -> why
    "runtimeSizes": {},                               // "Set › layer" -> "horizontal" | "vertical", sized in code
    "runtimeFills": [],                               // "Set › layer" whose fill is data
    "inline": ["Button"],                             // sets whose root is inline-flex
    "interactionPrefixes": {}                         // set -> { interaction value -> Tailwind variant }
  },
  "designMd": {                                       // optional
    "output": "../../DESIGN.md",
    "name": "Proteus",
    "description": "…"
  },
  "flow": {                                           // optional
    "output": "../../apps/store/src/navigation/flow.gen.ts",
    "screens": "../../apps/store/src/navigation/screens.ts", // the screen table; type-only imports, Node reads it
    "routeTree": "../../apps/store/src/routeTree.gen.ts"
  },
  "icons": { "set": "Icon", "output": "../../apps/store/src/components/ui/icon/icon.glyphs.tsx" }, // optional
  "brand": { "output": "../../apps/store/public" }    // optional
}
```

`tokens.textStyles.form` chooses between two forms:
- `utility` (the default) gives `@utility type-x`, a single class.
- `doubled` gives `@utility type-x { && { … } }`, which compiles to `.type-x.type-x` and beats a single
  utility a component hardcodes (`text-base`) whatever the order. tailwind-merge can't relate the two,
  so both reach the element.

Both take variants (`md:type-input` is `.md\:type-input.md\:type-input` under the breakpoint), so a set
whose text style changes across viewports exports. A style's decoration exports as
`text-decoration-line`, its underline offset as `text-underline-offset` in px.

If you add a `ts` output, also add `"./tokens": "./tokens/tokens.gen.ts"` to `exports` in
`package.json`.
