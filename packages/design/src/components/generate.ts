import type { ResolvedConfig } from '../config.ts'
import { formatTs } from '../files.ts'
import { readSnapshot } from '../tokens/snapshot.ts'
import { buildTokens } from '../tokens/tokens.ts'
import { buildComponents, type ComponentsContext } from './build.ts'
import { readComponentSets } from './snapshot.ts'

export function componentsContext(config: ResolvedConfig): ComponentsContext {
  if (!config.components) throw new Error('design.json has no `components` section')
  const tokens = readSnapshot(config.snapshot)
  return {
    config: config.components,
    variables: tokens.variables,
    textStyles: tokens.textStyles,
    effectStyles: tokens.effectStyles,
    textStylePrefix: config.tokens.textStyles.prefix,
    responsiveSizes: new Set(buildTokens(tokens, config.tokens).responsive.map((r) => r.key)),
  }
}

/** The variants files, by absolute path and formatted as the repo formats them, from the committed snapshot. */
export function generateComponents(config: ResolvedConfig) {
  const { files, notes } = buildComponents(readComponentSets(config.snapshot), componentsContext(config))
  return { files: formatTs(files, config.root), notes }
}
