import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { generateJobRegistry } from '../generate-job-registry.js'
import { generateSubscriberRegistry } from '../generate-subscriber-registry.js'
import { generateWorkerdCrons, run } from '../generate-workerd-crons.js'
import { generateWorkflowRegistry } from '../generate-workflow-registry.js'

const REAL_BACKEND = join(import.meta.dirname, '../..')

/** A throwaway `apps/backend/` holding only `files`, plus the real `CronExpression` enum. */
function backendWith(files: Record<string, string>): string {
  const backend = join(mkdtempSync(join(tmpdir(), 'runtime-registries-')), 'apps/backend')
  const write = (path: string, content: string) => {
    mkdirSync(dirname(join(backend, path)), { recursive: true })
    writeFileSync(join(backend, path), content)
  }
  for (const folder of ['workflows', 'subscribers', 'jobs'])
    mkdirSync(join(backend, 'src', folder), { recursive: true })
  for (const [path, content] of Object.entries(files)) write(path, content)
  mkdirSync(join(backend, 'src/core/types'), { recursive: true })
  copyFileSync(
    join(REAL_BACKEND, 'src/core/types/cron-expression.ts'),
    join(backend, 'src/core/types/cron-expression.ts'),
  )
  created.push(join(backend, '../..'))
  return backend
}

const created: string[] = []
afterEach(() => {
  for (const directory of created.splice(0)) rmSync(directory, { recursive: true, force: true })
})

const workflow = (binding: string, name: string) =>
  `export const ${binding} = createWorkflow('${name}', () => undefined)\n`
const subscriber = (name: string) => `export const config = { name: '${name}', event: 'x', handler: () => {} }\n`
const job = (name: string, schedule: string, extra = '') =>
  `export const config = { name: '${name}', schedule: ${schedule}, handler: () => {}${extra} }\n`

const messages = (result: { problems: { message: string }[] }) => result.problems.map((problem) => problem.message)

describe('the runtime registries read extensions', () => {
  test('workflows: an extension workflow is imported by a computed path, and must be prefixed and unique', () => {
    const valid = generateWorkflowRegistry(
      backendWith({
        'src/workflows/cart/add.ts': workflow('addWorkflow', 'add'),
        'src/extensions/acme-shop/workflows/notes/create.ts': workflow('createNoteWorkflow', 'acme-shop.create-note'),
      }),
    )
    expect(valid.problems).toEqual([])
    expect(valid.rendered).toContain(`import { addWorkflow } from '../../../workflows/cart/add.js'`)
    expect(valid.rendered).toContain(
      `import { createNoteWorkflow } from '../../../extensions/acme-shop/workflows/notes/create.js'`,
    )

    const invalid = generateWorkflowRegistry(
      backendWith({
        'src/workflows/add.ts': workflow('addWorkflow', 'add'),
        'src/extensions/acme-shop/workflows/note.ts': workflow('noteWorkflow', 'create-note'),
        'src/extensions/acme-shop/workflows/add.ts': workflow('acmeAddWorkflow', 'add'),
        'src/extensions/acme-shop/workflows/shadow.ts': workflow('addWorkflow', 'acme-shop.add'),
      }),
    )
    expect(messages(invalid)).toEqual([
      'the workflow "add" in extension "acme-shop" does not start with "acme-shop."',
      'the workflow "create-note" in extension "acme-shop" does not start with "acme-shop."',
      'two workflows are named "add" — also at apps/backend/src/workflows/add.ts:1',
      'two workflows are exported as `addWorkflow` — also at apps/backend/src/workflows/add.ts:1',
    ])
  })

  test('subscribers: an extension subscriber is imported by a computed path, and must be prefixed and unique', () => {
    const valid = generateSubscriberRegistry(
      backendWith({
        'src/subscribers/send-mail.ts': subscriber('send-mail'),
        'src/extensions/acme-shop/subscribers/log-note.ts': subscriber('acme-shop.log-note'),
      }),
    )
    expect(valid.problems).toEqual([])
    expect(valid.rendered).toContain(`import { config as sendMail } from './send-mail.js'`)
    expect(valid.rendered).toContain(
      `import { config as acmeShopLogNote } from '../extensions/acme-shop/subscribers/log-note.js'`,
    )

    const invalid = generateSubscriberRegistry(
      backendWith({
        'src/subscribers/send-mail.ts': subscriber('send-mail'),
        'src/extensions/acme-shop/subscribers/log-note.ts': subscriber('log-note'),
        'src/extensions/acme-shop/subscribers/send-mail.ts': subscriber('send-mail'),
      }),
    )
    expect(messages(invalid)).toEqual([
      'the subscriber "log-note" in extension "acme-shop" does not start with "acme-shop."',
      'the subscriber "send-mail" in extension "acme-shop" does not start with "acme-shop."',
      'two subscribers are named "send-mail" — also at apps/backend/src/subscribers/send-mail.ts:1',
    ])
  })

  test('jobs: an extension job is imported by a computed path, and must be prefixed and unique', () => {
    const valid = generateJobRegistry(
      backendWith({
        'src/jobs/census.ts': job('census', 'CronExpression.EVERY_HOUR'),
        'src/extensions/acme-shop/jobs/sweep.ts': job('acme-shop.sweep', 'CronExpression.EVERY_HOUR'),
      }),
    )
    expect(valid.problems).toEqual([])
    expect(valid.rendered).toContain(`import { config as census } from './census.js'`)
    expect(valid.rendered).toContain(`import { config as acmeShopSweep } from '../extensions/acme-shop/jobs/sweep.js'`)

    const invalid = generateJobRegistry(
      backendWith({
        'src/jobs/census.ts': job('census', 'CronExpression.EVERY_HOUR'),
        'src/extensions/acme-shop/jobs/sweep.ts': job('sweep', 'CronExpression.EVERY_HOUR'),
        'src/extensions/acme-shop/jobs/census.ts': job('census', 'CronExpression.EVERY_HOUR'),
      }),
    )
    expect(messages(invalid)).toEqual([
      'the job "census" in extension "acme-shop" does not start with "acme-shop."',
      'the job "sweep" in extension "acme-shop" does not start with "acme-shop."',
      'two jobs are named "census" — also at apps/backend/src/jobs/census.ts:1',
    ])
  })
})

describe('workerd cron triggers', () => {
  const Wrangler = `{
  "name": "proteus-backend",
  // A comment outside the triggers, kept.
  "vars": { "NOTE": "a // not a comment" },
  "triggers": {
    "crons": [
      // stale
      "* * * * *"
    ]
  },
  "queues": { "producers": [] }
}
`

  test('lists each enabled schedule once, core and extensions, and leaves the rest of the file alone', () => {
    const backend = backendWith({
      'src/jobs/census.ts': job('census', 'CronExpression.EVERY_10_MINUTES'),
      'src/jobs/heartbeat.ts': job('heartbeat', 'CronExpression.EVERY_MINUTE', ', disabled: true'),
      'src/jobs/report.ts': job('report', `'0 3 * * *'`),
      'src/extensions/acme-shop/jobs/sweep.ts': job('acme-shop.sweep', 'CronExpression.EVERY_10_MINUTES'),
    })

    const { rendered, problems } = generateWorkerdCrons(backend, Wrangler)

    expect(problems).toEqual([])
    expect(rendered).toBe(`{
  "name": "proteus-backend",
  // A comment outside the triggers, kept.
  "vars": { "NOTE": "a // not a comment" },
  "triggers": {
    // GENERATED by \`pnpm --filter backend run jobs:generate\` from the job registry, one entry per
    // schedule an enabled job runs on. Do not edit; \`pnpm verify\` fails when it drifts.
    "crons": [
      // census, acme-shop.sweep
      "*/10 * * * *",
      // report
      "0 3 * * *"
    ]
  },
  "queues": { "producers": [] }
}
`)
    expect(generateWorkerdCrons(backend, rendered).rendered).toBe(rendered)
  })

  test('the check fails on a stale cron list without writing, and a schedule it cannot read fails', () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const backend = backendWith({
      'src/jobs/census.ts': job('census', 'CronExpression.EVERY_10_MINUTES'),
      'wrangler.jsonc': Wrangler,
    })

    expect(run(backend, { checking: true })).toBe(1)
    expect(readFileSync(join(backend, 'wrangler.jsonc'), 'utf8')).toBe(Wrangler)
    expect(run(backend, { checking: false })).toBe(0)
    expect(run(backend, { checking: true })).toBe(0)

    const computed = backendWith({ 'src/jobs/census.ts': job('census', 'everyTenMinutes') })
    expect(messages(generateWorkerdCrons(computed, Wrangler))).toEqual([
      'the schedule of "census" cannot be read without running the code',
    ])
  })
})
