import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { ResolvedConfig } from '../config.ts'
import { brandProblems } from './build.ts'
import { readBrandSnapshot } from './snapshot.ts'

/**
 * Nothing to regenerate: the images are FigCraft's own output, written by brand:export. What the check can say
 * is whether each file the last export recorded is still there, at its size and unchanged.
 */
export function generateBrand(config: ResolvedConfig) {
  const brand = config.brand
  if (!brand) throw new Error('design.json has no `brand` section')
  const read = (file: string) => {
    const path = join(brand.output, file)
    return existsSync(path) ? readFileSync(path) : undefined
  }
  return {
    files: new Map<string, string>(),
    notes: [],
    problems: brandProblems(readBrandSnapshot(config.snapshot), read),
  }
}
