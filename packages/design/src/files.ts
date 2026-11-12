import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

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
    .map(([path]) => path)
}

/**
 * Formats generated TS the way the repo's Biome would, so the verify gate's formatter leaves it as
 * generated and `--check` compares like with like. Biome is the repo root's, found by walking up.
 */
export function formatTs(files: Map<string, string>, from: string): Map<string, string> {
  if (files.size === 0) return files
  const repo = repoWithBiome(from)
  const biome = join(repo, 'node_modules/.bin/biome')
  return new Map(
    [...files].map(([path, source]) => [
      path,
      execFileSync(biome, ['format', `--stdin-file-path=${relative(repo, path)}`], {
        cwd: repo,
        input: source,
        encoding: 'utf8',
      }),
    ]),
  )
}

function repoWithBiome(from: string): string {
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'node_modules/.bin/biome')) && existsSync(join(dir, 'biome.json'))) return dir
    if (dirname(dir) === dir) throw new Error(`no Biome found above ${from}; the generated TS is formatted with it`)
  }
}
