import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import type { ResolvedConfig } from './config.ts'
import { renderCss } from './render-css.ts'
import { renderTs } from './render-ts.ts'
import { readSnapshot } from './snapshot.ts'
import { buildTokens } from './tokens.ts'

/** The generated files, by absolute path, from the committed snapshot. */
export function generate(config: ResolvedConfig): Map<string, string> {
  const tokens = buildTokens(readSnapshot(config.snapshot), config)
  const files = new Map([[config.output.css, renderCss(tokens, config)]])
  if (config.output.ts) files.set(config.output.ts, renderTs(tokens))
  return files
}

export function write(files: Map<string, string>) {
  for (const [path, content] of files) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
  }
}

/** The generated files whose content on disk differs from what the snapshot produces. */
export function stale(files: Map<string, string>): string[] {
  return [...files]
    .filter(([path, content]) => !existsSync(path) || readFileSync(path, 'utf8') !== content)
    .map(([p]) => p)
}
