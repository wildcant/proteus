import type { ResolvedConfig } from '../config.ts'
import { formatTs } from '../files.ts'
import { buildIcons } from './build.ts'
import { readIconSnapshot } from './snapshot.ts'

/** The glyph file, formatted as the repo formats it, from the committed snapshot; none while there are no glyphs. */
export function generateIcons(config: ResolvedConfig) {
  if (!config.icons) throw new Error('design.json has no `icons` section')
  return { files: formatTs(buildIcons(readIconSnapshot(config.snapshot), config.icons), config.root), notes: [] }
}
