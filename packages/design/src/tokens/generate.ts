import type { ResolvedConfig } from '../config.ts'
import { renderCss } from './render-css.ts'
import { renderTs } from './render-ts.ts'
import { readSnapshot } from './snapshot.ts'
import { buildTokens } from './tokens.ts'

/** The generated files, by absolute path, from the committed snapshot. */
export function generateTokens(config: ResolvedConfig): Map<string, string> {
  const tokens = buildTokens(readSnapshot(config.snapshot), config.tokens)
  const files = new Map([[config.tokens.output.css, renderCss(tokens, config.tokens)]])
  if (config.tokens.output.ts) files.set(config.tokens.output.ts, renderTs(tokens))
  return files
}
