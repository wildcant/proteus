import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'

export const CONFIG_FILE = 'design-tokens.json'
/**
 * Where this machine keeps the design file and FigCraft's CLI. Gitignored: those paths are personal,
 * and only `tokens:export` needs them. Beside the config file, same shape as `Local`.
 */
const LOCAL_CONFIG_FILE = 'design-tokens.local.json'

/** Machine-specific settings, from design-tokens.local.json or the environment (which wins). */
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

/** The shared settings, committed. */
type Config = {
  /** Folder for the exported FigCraft JSON (committed, so `tokens` runs without FigCraft). */
  snapshot: string
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
    /** `fluid`: clamp() between the first two modes. `steps`: each later mode applies from its width up. */
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

/** The config with every path absolute and every default filled in. */
export type ResolvedConfig = Required<Omit<Config, 'viewport' | 'output'>> & {
  root: string
  /** Only `tokens:export` needs it; a build from the snapshot runs without. */
  file: string | undefined
  cli: string
  viewport: Config['viewport']
  output: { css: string; ts: string | undefined }
  textStyles: Required<NonNullable<Config['textStyles']>>
}

export function loadConfig(path: string): ResolvedConfig {
  const config = JSON.parse(readFileSync(path, 'utf8')) as Config
  const root = dirname(resolve(path))
  const fromRoot = (p: string) => (isAbsolute(p) ? p : join(root, p))
  validate(config, path)
  const localPath = join(root, LOCAL_CONFIG_FILE)
  const local = existsSync(localPath) ? (JSON.parse(readFileSync(localPath, 'utf8')) as Local) : {}
  const file = process.env.FIGCRAFT_FILE ?? local.file
  return {
    root,
    file: file ? expandHome(file) : undefined,
    cli: expandHome(process.env.FIGCRAFT_CLI ?? local.cli ?? 'figcraft-cli'),
    snapshot: fromRoot(config.snapshot),
    output: { css: fromRoot(config.output.css), ts: config.output.ts ? fromRoot(config.output.ts) : undefined },
    theme: config.theme,
    viewport: config.viewport,
    textStyles: { prefix: config.textStyles?.prefix ?? 'type-', form: config.textStyles?.form ?? 'utility' },
    paletteInTheme: config.paletteInTheme ?? false,
    rootFontSize: config.rootFontSize ?? 16,
  }
}

function validate(config: Config, path: string) {
  const fail = (message: string) => {
    throw new Error(`${path}: ${message}`)
  }
  if (!config.snapshot) fail('`snapshot` is required')
  if (!config.output?.css) fail('`output.css` is required')
  if (!config.theme?.collection || !config.theme.modes?.length)
    fail('`theme.collection` and `theme.modes` are required')
  if (config.viewport?.scale === 'fluid' && config.viewport.modes.length !== 2) {
    fail('a fluid `viewport` interpolates between exactly two modes')
  }
}

function expandHome(path: string) {
  return path.startsWith('~/') ? join(homedir(), path.slice(2)) : path
}
