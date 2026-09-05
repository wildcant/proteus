/**
 * Dev entrypoint for the Worker — `npm run --workspace=backend worker:dev`. Production runs
 * `worker.ts` directly and never loads this file.
 *
 * All it adds is regenerating `registry.gen.ts` before booting, so adding a workflow file needs no
 * second command. `tsx --watch` is pointed here with `--include 'src/workflows/**'`, which is what
 * makes a *brand new* file restart the Worker at all: the watcher otherwise only follows modules
 * already in the graph, and a file nothing imports yet is by definition not in it.
 *
 * The generator runs as a child process rather than an import so the Worker never carries a parser
 * into its own module graph — `tsx --watch` would then reload on every file the generator touches,
 * which is every workflow twice over.
 *
 * A failure here is deliberately fatal. If the source tree cannot be read, booting anyway would
 * register whatever the last good run happened to leave on disk, which is the stale-registry
 * problem this whole mechanism exists to remove.
 */

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const workspace = fileURLToPath(new URL('../../', import.meta.url))

execFileSync('npm', ['run', '--silent', 'workflows:generate'], { cwd: workspace, stdio: 'inherit' })

await import('./worker.js')
