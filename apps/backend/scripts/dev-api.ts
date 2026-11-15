/**
 * Dev entrypoint for the API — `pnpm --filter backend run dev`. Production runs `src/index.ts`
 * directly and never loads this file.
 *
 * All it adds is regenerating the extension registry before booting, as the three Workers' dev
 * entrypoints do, so a file added to an extension needs no second command. `tsx watch` is pointed
 * here with `--include 'src/extensions/**'`, which is what makes a *brand new* extension file
 * restart the API at all: the watcher otherwise only follows modules already in the graph. The
 * generated registries are excluded from the watch, or writing them would restart the API that just
 * wrote them.
 *
 * The generator runs as a child process rather than an import so the API never carries a parser
 * into its own module graph. A failure here is fatal: booting anyway would serve whatever registry
 * the last good run left on disk.
 */

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const workspace = fileURLToPath(new URL('../', import.meta.url))

execFileSync('pnpm', ['--silent', 'run', 'extensions:generate'], { cwd: workspace, stdio: 'inherit' })

await import('../src/index.js')
