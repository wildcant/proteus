// node src/cli.ts <exporter> [--export [Set…]] [--check] [--config design.json]
//
//   tokens       the theme stylesheet, from the variables and text styles
//   components   one <name>.variants.ts per component set, beside its component in the app
//   design-md    DESIGN.md's frontmatter, from both snapshots (its prose is left alone)
//   flow         the store's navigation map, from the `flows` page; --check also runs check:flow
//   icons        the store's Icon glyphs, from the Icon set
//   brand        the favicon and touch icons in the store's public folder (written by --export only)
//
// Without a flag, regenerates from the committed snapshot (no FigCraft needed). --export refreshes the
// exporter's snapshot from the design file first (components: every set, or the named ones). --check
// writes nothing and exits 1 when a generated file is not what the snapshot produces, or an exporter reports a
// problem (check:flow's, a brand file changed since its export).
//
// Reads design.json from the current directory, or the path given with --config.
import { relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { generateBrand } from './brand/generate.ts'
import { exportBrandSnapshot } from './brand/snapshot.ts'
import { generateComponents } from './components/generate.ts'
import { exportComponentSnapshot } from './components/snapshot.ts'
import { CONFIG_FILE, loadConfig, type ResolvedConfig } from './config.ts'
import { generateDesignMd } from './design-md/generate.ts'
import { stale, write } from './files.ts'
import { generateFlow } from './flow/generate.ts'
import { exportFlowSnapshot } from './flow/snapshot.ts'
import { generateIcons } from './icons/generate.ts'
import { exportIconSnapshot } from './icons/snapshot.ts'
import { generateTokens } from './tokens/generate.ts'
import { exportTokenSnapshot } from './tokens/snapshot.ts'

type Exporter = {
  exportSnapshot?: (config: ResolvedConfig, names: string[]) => void
  generate: (config: ResolvedConfig) => Generated | Promise<Generated>
}

/** What an exporter produces from the snapshot, and what `--check` fails on besides stale files. */
type Generated = { files: Map<string, string>; notes: string[]; problems?: string[] }

const EXPORTERS: Record<string, Exporter> = {
  tokens: { exportSnapshot: exportTokenSnapshot, generate: (config) => ({ files: generateTokens(config), notes: [] }) },
  components: { exportSnapshot: exportComponentSnapshot, generate: generateComponents },
  'design-md': { generate: (config) => ({ files: generateDesignMd(config), notes: [] }) },
  flow: { exportSnapshot: exportFlowSnapshot, generate: generateFlow },
  icons: { exportSnapshot: exportIconSnapshot, generate: generateIcons },
  brand: { exportSnapshot: exportBrandSnapshot, generate: generateBrand },
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    export: { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
    config: { type: 'string', default: CONFIG_FILE },
  },
})

try {
  const [name = '', ...setNames] = positionals
  const exporter = EXPORTERS[name]
  if (!exporter) throw new Error(`name an exporter: ${Object.keys(EXPORTERS).join(', ')}`)
  const config = loadConfig(resolve(values.config))
  const show = (path: string) => relative(process.cwd(), path)
  if (values.export) {
    if (!exporter.exportSnapshot) throw new Error(`${name} has no --export: it reads the other exporters' snapshot`)
    exporter.exportSnapshot(config, setNames)
    console.info(`exported the design file -> ${show(config.snapshot)}`)
  }
  const { files, notes, problems = [] } = await exporter.generate(config)
  if (values.check) {
    const outdated = stale(files)
    if (outdated.length > 0) {
      process.stderr.write(
        `design: out of date, run \`pnpm --filter @proteus/design run ${name}\` and commit the result:\n${outdated.map((p) => `  ${show(p)}\n`).join('')}`,
      )
    }
    if (problems.length > 0) process.stderr.write(`design: ${name}:\n${problems.map((p) => `  ${p}\n`).join('')}`)
    if (outdated.length > 0 || problems.length > 0) process.exit(1)
  } else {
    for (const note of notes) console.info(`note: ${note}`)
    write(files)
    console.info(files.size ? `wrote ${[...files.keys()].map(show).join(', ')}` : 'nothing to write')
  }
} catch (error) {
  process.stderr.write(`design: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
}
