/**
 * Dev entrypoint for the cron Worker — `pnpm --filter backend run worker:cron:dev`. Production runs
 * `worker.ts` directly and never loads this file, which is also why the `cron-worker` compose
 * service still names the production script: a watcher inside a container never fires, because the
 * bind mount carries writes but not filesystem events.
 *
 * All it adds is regenerating `registry.gen.ts` before booting, so adding a job file needs no second
 * command. `tsx --watch` is pointed here with `--include 'src/jobs/**'`, which is what makes a
 * *brand new* file restart the Worker at all: the watcher otherwise only follows modules already in
 * the graph, and a file nothing imports yet is by definition not in it. The generated registry is
 * excluded from the watch, or writing it would restart the Worker that just wrote it.
 *
 * The generator runs as a child process rather than an import so the Worker never carries a parser
 * into its own module graph — `tsx --watch` would then reload on every file the generator touches,
 * which is every job twice over.
 *
 * A failure here is deliberately fatal, and more so than for the other two Workers. Booting anyway
 * would register whatever the last good run left on disk — and for cron that list is also the
 * desired state reconciliation sweeps against, so a stale registry does not merely fail to run a
 * job, it deletes that job's Schedule.
 */

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const workspace = fileURLToPath(new URL('../../../../', import.meta.url))

execFileSync('pnpm', ['--silent', 'run', 'jobs:generate'], { cwd: workspace, stdio: 'inherit' })

await import('./worker.js')
