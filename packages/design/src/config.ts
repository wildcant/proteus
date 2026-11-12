import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'

export const CONFIG_FILE = 'design.json'
/**
 * Where this machine keeps the design file and FigCraft's CLI. Gitignored: those paths are personal,
 * and only the `--export` runs need them. Beside the config file, same shape as `Local`.
 */
const LOCAL_CONFIG_FILE = 'design.local.json'

/** Machine-specific settings, from design.local.json or the environment (which wins). */
type Local = {
  /** The design file. `~` is expanded. FIGCRAFT_FILE overrides it. */
  file?: string
  /** FigCraft's headless CLI. FIGCRAFT_CLI overrides it; without either, `figcraft-cli` must be on PATH. */
  cli?: string
}

/** One Theme mode and where its colours apply. The first mode is the default, on `:root`. */
type ThemeMode = {
  mode: string
  selector: string
  /** Also apply this mode under a media query, e.g. `(prefers-color-scheme: dark)`. */
  media?: { query: string; selector: string }
}

/** One Viewport mode and the viewport width it is designed at. The first mode is the base (mobile first). */
type ViewportMode = { mode: string; width: number }

type TokensSection = {
  output: {
    /** Tailwind v4 stylesheet: `@theme`, the colour modes, the responsive sizes and the text style classes. */
    css: string
    /** Optional TS module with the raw values, for code that cannot take a class (SVG, canvas, charts). */
    ts?: string
  }
  theme: {
    collection: string
    modes: ThemeMode[]
  }
  viewport?: {
    collection: string
    modes: ViewportMode[]
    /**
     * `fluid`: clamp() between the first and the last mode; any mode between them is for drawing frames at
     * that width and must hold the interpolated value. `steps`: each later mode applies from its width up.
     */
    scale: 'fluid' | 'steps'
  }
  textStyles?: {
    /** Class name prefix for `type/<name>`; default `type-`. */
    prefix?: string
    /**
     * `utility` (default): `@utility type-x`, which takes variants (`lg:type-x`).
     * `doubled`: `.type-x.type-x` in `@layer utilities`, which outranks a single utility such as
     * `text-base` that a component hardcodes, at the cost of variants.
     */
    form?: 'utility' | 'doubled'
  }
  /** Also put palette/* in `@theme` as `--color-<ramp>-<step>`. Off by default: use the Theme roles in classes. */
  paletteInTheme?: boolean
  /** Root font size for px -> rem; default 16. */
  rootFontSize?: number
}

type ComponentsSection = {
  /** The app's `src` folder; the page a set sits on picks the folder under it. */
  root: string
  /** Sets drawn in the design file that never become variants files: name -> why. */
  notExported?: Record<string, string>
  /** Pages whose sets are never exported (system screens composed in code), besides `app/*` and `flows`. */
  skippedPages?: string[]
  /** Layers that get no cva: `Set › layer` -> why. */
  notStyledLayers?: Record<string, string>
  /** Sizes set at run time, which the design only previews: `Set › layer` -> the axis left to code. */
  runtimeSizes?: Record<string, 'horizontal' | 'vertical'>
  /** Fills that are data, which the design shows one example of: `Set › layer`. The component passes the colour. */
  runtimeFills?: string[]
  /** Sets whose component sits in a line of text: its root is `inline-flex`, not `flex`. */
  inline?: string[]
  /**
   * The Tailwind variant an `interaction` or `position` value maps to, per set, where it isn't the value itself: a
   * Base UI part that marks its state with a data attribute, `{ "Checkbox": { "disabled": "data-disabled" } }`, a
   * hover that a disabled button ignores, `{ "hover": "enabled:hover" }`, or a position of its own,
   * `{ "afterCurrent": "[[data-current]+&]" }`.
   */
  interactionPrefixes?: Record<string, Record<string, string>>
  /**
   * Layers that take the interaction states as their own, per set: each is its own element with its own hover and
   * disabled (a stepper's two buttons), so its classes use the plain variants and its layers follow it through
   * `group-*\/<set>-<layer>`, not the component's.
   */
  interactionParts?: Record<string, string[]>
  /** Layers placed at run time (a tooltip's arrow, which Base UI moves along the edge): `absolute`, no inset. */
  runtimePositions?: string[]
  /** Sets whose root fills its parent's width (`w-full`), as the form controls do. */
  fullWidth?: string[]
  /**
   * A text style a layer sets for the text inside it to inherit (a drawer panel's `text-sm`): `Set` or
   * `Set › layer` -> `type/*`. FigCraft puts text styles on text layers only.
   */
  inheritedText?: Record<string, string>
}

type DesignMdSection = {
  /** The DESIGN.md whose frontmatter is generated; its prose is left alone. */
  output: string
  name: string
  description: string
}

type FlowSection = {
  /** The generated flow map, in the app's navigation module. */
  output: string
  /** The hand-written screen table (`Screen` or `Screen/state` -> route), read by check:flow. Type-only imports. */
  screens: string
  /** The app's TanStack Router `routeTree.gen.ts`; its route files are found from it. */
  routeTree: string
}

type IconsSection = {
  /** The component set whose variants (`name=<kebab-case>`) are the glyphs. */
  set: string
  /** The generated glyph file, in the app's Icon folder. */
  output: string
}

type BrandSection = {
  /** The app's public folder; each export frame's pluginData names its file inside it. */
  output: string
}

/** The shared settings, committed. One section per exporter. */
type Config = {
  /** Folder for the exported FigCraft JSON (committed, so the builds run without FigCraft). */
  snapshot: string
  tokens: TokensSection
  components?: ComponentsSection
  designMd?: DesignMdSection
  flow?: FlowSection
  icons?: IconsSection
  brand?: BrandSection
}

export type FigCraftLocation = {
  /** Only the `--export` runs need it; a build from the snapshot runs without. */
  file: string | undefined
  cli: string
}

/** The tokens section with every path absolute and every default filled in. */
export type TokensConfig = Required<Omit<TokensSection, 'viewport' | 'output' | 'textStyles'>> & {
  viewport: TokensSection['viewport']
  output: { css: string; ts: string | undefined }
  textStyles: Required<NonNullable<TokensSection['textStyles']>>
}

export type ComponentsConfig = Required<ComponentsSection>

export type ResolvedConfig = {
  root: string
  snapshot: string
  figcraft: FigCraftLocation
  tokens: TokensConfig
  components: ComponentsConfig | undefined
  designMd: DesignMdSection | undefined
  flow: FlowSection | undefined
  icons: IconsSection | undefined
  brand: BrandSection | undefined
}

export function loadConfig(path: string): ResolvedConfig {
  const config = JSON.parse(readFileSync(path, 'utf8')) as Config
  const root = dirname(resolve(path))
  const fromRoot = (p: string) => (isAbsolute(p) ? p : join(root, p))
  validate(config, path)
  const localPath = join(root, LOCAL_CONFIG_FILE)
  const local = existsSync(localPath) ? (JSON.parse(readFileSync(localPath, 'utf8')) as Local) : {}
  const file = process.env.FIGCRAFT_FILE ?? local.file
  const { tokens, components, designMd, flow, icons, brand } = config
  return {
    root,
    snapshot: fromRoot(config.snapshot),
    figcraft: {
      file: file ? expandHome(file) : undefined,
      cli: expandHome(process.env.FIGCRAFT_CLI ?? local.cli ?? 'figcraft-cli'),
    },
    tokens: {
      output: { css: fromRoot(tokens.output.css), ts: tokens.output.ts ? fromRoot(tokens.output.ts) : undefined },
      theme: tokens.theme,
      viewport: tokens.viewport,
      textStyles: { prefix: tokens.textStyles?.prefix ?? 'type-', form: tokens.textStyles?.form ?? 'utility' },
      paletteInTheme: tokens.paletteInTheme ?? false,
      rootFontSize: tokens.rootFontSize ?? 16,
    },
    components: components && {
      root: fromRoot(components.root),
      notExported: components.notExported ?? {},
      skippedPages: components.skippedPages ?? [],
      notStyledLayers: components.notStyledLayers ?? {},
      runtimeSizes: components.runtimeSizes ?? {},
      runtimeFills: components.runtimeFills ?? [],
      inline: components.inline ?? [],
      interactionPrefixes: components.interactionPrefixes ?? {},
      interactionParts: components.interactionParts ?? {},
      runtimePositions: components.runtimePositions ?? [],
      fullWidth: components.fullWidth ?? [],
      inheritedText: components.inheritedText ?? {},
    },
    designMd: designMd && { ...designMd, output: fromRoot(designMd.output) },
    flow: flow && {
      output: fromRoot(flow.output),
      screens: fromRoot(flow.screens),
      routeTree: fromRoot(flow.routeTree),
    },
    icons: icons && { ...icons, output: fromRoot(icons.output) },
    brand: brand && { output: fromRoot(brand.output) },
  }
}

function validate(config: Config, path: string) {
  const fail = (message: string) => {
    throw new Error(`${path}: ${message}`)
  }
  if (!config.snapshot) fail('`snapshot` is required')
  const tokens = config.tokens
  if (!tokens?.output?.css) fail('`tokens.output.css` is required')
  if (!tokens.theme?.collection || !tokens.theme.modes?.length) {
    fail('`tokens.theme.collection` and `tokens.theme.modes` are required')
  }
  if (tokens.viewport?.scale === 'fluid' && tokens.viewport.modes.length < 2) {
    fail('a fluid `tokens.viewport` interpolates between its first and last mode: give at least two')
  }
  if (config.components && !config.components.root) fail('`components.root` is required')
  if (config.designMd && !(config.designMd.output && config.designMd.name && config.designMd.description)) {
    fail('`designMd` needs `output`, `name` and `description`')
  }
  if (config.flow && !(config.flow.output && config.flow.screens && config.flow.routeTree)) {
    fail('`flow` needs `output`, `screens` and `routeTree`')
  }
  if (config.icons && !(config.icons.set && config.icons.output)) fail('`icons` needs `set` and `output`')
  if (config.brand && !config.brand.output) fail('`brand.output` is required')
}

function expandHome(path: string) {
  return path.startsWith('~/') ? join(homedir(), path.slice(2)) : path
}
