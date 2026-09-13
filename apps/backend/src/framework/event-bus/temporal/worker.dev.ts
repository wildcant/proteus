/**
 * Dev entrypoint for the events Worker — `pnpm --filter backend run worker:events:dev`. Production
 * runs `worker.ts` directly and never loads this file, which is also why the `events-worker` compose
 * service still names the production script: a watcher inside a container never fires, because the
 * bind mount carries writes but not filesystem events.
 *
 * All it adds is regenerating `registry.gen.ts` before booting, so adding a subscriber file needs no
 * second command. `tsx --watch` is pointed here with `--include 'src/subscribers/**'`, which is what
 * makes a *brand new* file restart the Worker at all: the watcher otherwise only follows modules
 * already in the graph, and a file nothing imports yet is by definition not in it. The generated
 * registry is excluded from the watch, or writing it would restart the Worker that just wrote it.
 *
 * The generator runs as a child process rather than an import so the Worker never carries a parser
 * into its own module graph — `tsx --watch` would then reload on every file the generator touches,
 * which is every subscriber twice over.
 *
 * A failure here is deliberately fatal. If the source tree cannot be read, booting anyway would
 * register whatever the last good run happened to leave on disk, which is the stale-registry
 * problem this whole mechanism exists to remove.
 *
 * This is the workflow Worker's `worker.dev.ts`, verbatim but for the generator it calls. The cron
 * Worker has no equivalent: its job list is hand-written, so there is nothing to generate.
 */

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const workspace = fileURLToPath(new URL('../../../../', import.meta.url))

execFileSync('pnpm', ['--silent', 'run', 'subscribers:generate'], { cwd: workspace, stdio: 'inherit' })

await import('./worker.js')
