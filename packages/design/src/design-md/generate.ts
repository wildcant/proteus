import { existsSync, readFileSync } from 'node:fs'

import { componentsContext } from '../components/generate.ts'
import { readComponentSets } from '../components/snapshot.ts'
import type { ResolvedConfig } from '../config.ts'
import { readSnapshot } from '../tokens/snapshot.ts'
import { buildTokens } from '../tokens/tokens.ts'
import { buildFrontmatter, withFrontmatter } from './build.ts'

/** DESIGN.md with its frontmatter generated from the committed snapshot and its prose as it is on disk. */
export function generateDesignMd(config: ResolvedConfig): Map<string, string> {
  const designMd = config.designMd
  if (!designMd) throw new Error('design.json has no `designMd` section')
  const frontmatter = buildFrontmatter({
    name: designMd.name,
    description: designMd.description,
    tokens: buildTokens(readSnapshot(config.snapshot), config.tokens),
    components:
      designMd.components === false
        ? undefined
        : { sets: readComponentSets(config.snapshot), context: componentsContext(config) },
  })
  const document = existsSync(designMd.output) ? readFileSync(designMd.output, 'utf8') : ''
  return new Map([[designMd.output, withFrontmatter(document, frontmatter)]])
}
