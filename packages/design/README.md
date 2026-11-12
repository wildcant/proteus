# @proteus/design

The project's design tokens, generated from a FigCraft design file into a Tailwind v4 theme.
Everything lives in this folder: the generator, its config, the FigCraft snapshot, and the generated
CSS. Apps import the CSS and never edit it.

```css
/* apps/<app>/src/styles.css, after `@import "tailwindcss"` */
@import "@proteus/design/tokens.css";
```

## Commands

Run them from this folder, or with `pnpm --filter @proteus/design run <script>`.

| Script | What it does |
|---|---|
| `tokens:export` | Exports the snapshot from the design file (`figcraft/*.json`), then regenerates `tokens/`. Needs FigCraft's CLI. |
| `tokens` | Regenerates `tokens/` from the committed snapshot. No FigCraft needed. |
| `tokens:check` | Exits 1 when `tokens/` is not what the snapshot produces. Writes nothing; `scripts/verify.sh` runs it. |
| `test` | The generator's tests. |

To change a token, change it in the design file, run `tokens:export`, and commit `figcraft/` and
`tokens/` together.

## Set up this machine

`tokens:export` needs to know where the design file and FigCraft's CLI are. Those paths are personal,
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

`tokens` and `tokens:check` read only the committed snapshot. They need none of this, which is why CI
runs them as is.

## Switch to another design file

For example, when a fork of this blueprint gets its own design:

1. Check the new file follows the [naming rules](#naming-rules-for-the-design-file). It needs:
   - a Theme collection with the modes `theme.modes` lists (`Light`, `Dark`);
   - a Viewport collection with the modes `viewport.modes` lists (`Mobile`, `Desktop`), or no
     `viewport` in the config;
   - every `type/*` text style's font bound to a `font/*` variable.
   If the file names its collections or modes differently, change `theme` and `viewport` in
   `design.json` to match.
2. Point `file` in `design.local.json` at the new file.
3. Run `pnpm --filter @proteus/design run tokens:export`. It replaces `figcraft/` and `tokens/`.
   If the file breaks a rule, the export stops and names the variable or style.
4. Check what the apps use that the new file no longer defines. The generated CSS only declares what
   the file has: a role that is gone (say `ink-subtle`) leaves its `text-ink-subtle` classes without a
   colour, and Tailwind doesn't warn. Search the apps for the roles that left, and repoint the app
   stylesheet's own aliases (for example `--primary: var(--ink)`) at the new roles.
5. Commit `figcraft/` and `tokens/` together.

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
5. Optionally, add `tokens:check` and `test` to the project's verification gate.

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
| `space/<key>` | `--spacing-<key>` |
| `radius/<key>` | `--radius-<key>` |
| `tracking/<key>` (percent of the font size) | `--tracking-<key>` in em |
| `stroke/<key>` | TS output only |
| Viewport collection, any number (one value per viewport mode) | Responsive: `clamp()` between two widths (`fluid`), or overridden by `min-width` (`steps`) |
| Text style `type/<name>` | Class `type-<name>`: family, size, weight, line height, letter spacing and case |
| Any other name | Kept in the TS output under `other`, never dropped |

For text styles:
- The font family must be bound to a `font/*` variable; the generator stops with an error otherwise.
- Bind the size (and line height, if in px) to `type/<name>/size|leading` variables. Put those in the
  Viewport collection to make them responsive.
- The weight comes from the style name (Regular 400 … ExtraBold 800).
- A percent line height becomes unitless (90 % → `0.9`).

Colours may have alpha: they export as `#rrggbbaa`.

## Config: `design.json`

Committed and shared. The machine paths are in `design.local.json`, not here.

```jsonc
{
  "snapshot": "figcraft",                           // the committed export
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
  "textStyles": { "prefix": "type-", "form": "doubled" }, // "utility" (default) supports variants
  "paletteInTheme": false,
  "rootFontSize": 16
}
```

`textStyles.form` chooses between two forms:
- `utility` (the default) gives `@utility type-x`, which works with variants such as `lg:type-x`.
- `doubled` gives `.type-x.type-x`, which beats a single utility a component hardcodes (`text-base`)
  whatever the order. tailwind-merge can't relate the two, so both reach the element. The cost is
  that variants don't work.

If you add a `ts` output, also add `"./tokens": "./tokens/tokens.gen.ts"` to `exports` in
`package.json`.
