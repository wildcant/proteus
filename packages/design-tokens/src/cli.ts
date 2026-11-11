// pnpm run tokens           regenerate the theme from the committed snapshot (no FigCraft needed)
// pnpm run tokens:export    export the snapshot from the design file first, then regenerate
// pnpm run tokens:check     exit 1 when a generated file is not what the snapshot produces
//
// Reads design-tokens.json from the current directory, or the path given with --config.
import { relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { generate, stale, write } from './build.ts'
import { CONFIG_FILE, loadConfig } from './config.ts'
import { exportSnapshot } from './snapshot.ts'

const { values } = parseArgs({
  options: {
    export: { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
    config: { type: 'string', default: CONFIG_FILE },
  },
})

try {
  const config = loadConfig(resolve(values.config))
  const show = (path: string) => relative(process.cwd(), path)
  if (values.export) {
    exportSnapshot(config)
    console.info(`exported the design file -> ${show(config.snapshot)}`)
  }
  const files = generate(config)
  if (values.check) {
    const outdated = stale(files)
    if (outdated.length > 0) {
      process.stderr.write(
        `design-tokens: out of date, run \`pnpm --filter @proteus/design-tokens run tokens\` and commit the result:\n${outdated.map((p) => `  ${show(p)}\n`).join('')}`,
      )
      process.exit(1)
    }
  } else {
    write(files)
    console.info(`wrote ${[...files.keys()].map(show).join(', ')}`)
  }
} catch (error) {
  process.stderr.write(`design-tokens: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
}
