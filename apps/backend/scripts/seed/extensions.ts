import type { AppContainer } from '../../src/core/types/container.js'
import type { Logger } from '../../src/core/types/logger.js'
import type { ExtensionSeed } from '../../src/framework/extensions/types.js'

function compareNames(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/**
 * Runs the extensions' dev seed steps, one at a time, in extension-name then file-name order — the
 * order `seeds.gen.ts` lists them in, restated here so a hand-built list in a test runs the same way.
 * Sequential on purpose: a later step may read what an earlier one wrote.
 */
export async function runExtensionSeeds(
  seeds: readonly ExtensionSeed[],
  context: { container: AppContainer; logger: Logger },
): Promise<void> {
  const ordered = [...seeds].sort((a, b) => compareNames(a.extension, b.extension) || compareNames(a.name, b.name))
  for (const seed of ordered) {
    context.logger.info(`[seed] extension "${seed.extension}": ${seed.name}`)
    await seed.run(context)
  }
}
