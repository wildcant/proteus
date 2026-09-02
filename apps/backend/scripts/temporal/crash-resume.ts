import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { Client, Connection } from '@temporalio/client'
import { ulid } from 'ulid'
import { env } from '../../src/env.js'
import { PAYLOAD_CONVERTER_PATH, PROTEUS_WORKFLOW_TYPE, TEMPORAL_TASK_QUEUE } from '../../src/temporal/config.js'
import { createWorkerContainer } from '../../src/temporal/container.js'
import { payloadConverter } from '../../src/temporal/payload-converter.js'
import type { AdvanceWorkflowResult, DriverInput } from '../../src/temporal/types.js'
import { completeCartWorkflow } from '../../src/workflows/cart/complete-cart.js'
import { seedCheckoutCart } from './checkout-cart.js'

/**
 * The demonstration the whole project was for: a checkout that survives losing the process running
 * it.
 *
 * It starts `complete-cart`, waits until a few steps have completed, stops the Worker, starts a new
 * one, and then prints — from Temporal's own history — which OS process ran each of the 14 steps.
 * Every step appears exactly once, and the split between the two process ids is where the Worker
 * died. Under the simple adapter there is no equivalent: the workflow lives in the process, so
 * losing the process loses the checkout, mid-payment and all.
 *
 *   docker compose -f apps/backend/docker-compose.yml up -d --wait
 *   docker compose -f apps/backend/docker-compose.test.yml up -d --wait
 *   npm run --workspace=backend db:migrate:test
 *   npm run --workspace=backend temporal:crash-resume
 *   npm run --workspace=backend temporal:crash-resume -- --hard
 *
 * `--hard` is the other half of the truth. The default stops the Worker with SIGTERM, which drains
 * the step in flight before exiting — that is the case durability covers, and the one AC3's evidence
 * is about. `--hard` sends SIGKILL instead, taking the step down with the process, and shows the
 * documented consequence of `maximumAttempts: 1`: the activity hits `startToCloseTimeout`, fails as
 * a `TimeoutFailure` that names no step, and the execution compensates rather than resuming. Both
 * behaviours are deliberate and both are recorded in ADR-0021; this is how to see either one.
 *
 * Runs against `.env.test` with `NODE_ENV=test`, for the same reason `measure-payload.ts` does: the
 * rows are throwaway checkouts, and the dev environment would email an order confirmation to the
 * invented address.
 */

/** How many steps to let the first Worker finish before it is stopped. Nothing special about 6 — it
 *  is past `create-order`, so the checkout has already written something a rollback would undo. */
const STEPS_BEFORE_STOP = 6

/** Short, because `--hard` waits out this timeout on purpose and five minutes is a long demo. */
const STEP_TIMEOUT_SECONDS = 20

const hard = process.argv.includes('--hard')
const backend = fileURLToPath(new URL('../..', import.meta.url))

const dataConverter = { payloadConverterPath: PAYLOAD_CONVERTER_PATH }
const connection = await Connection.connect({ address: env.TEMPORAL_ADDRESS })
const client = new Client({ connection, namespace: env.TEMPORAL_NAMESPACE, dataConverter })

const { container, shutdown } = await createWorkerContainer()

let worker: ReturnType<typeof startWorker> | undefined

try {
  console.info('› seeding a checkout-ready cart')
  const { cartId } = await seedCheckoutCart(container, { lineItems: 3 })

  console.info('› starting Worker #1')
  worker = startWorker('#1')
  await worker.ready

  const workflowId = `crash-resume-${ulid()}`
  const driver: DriverInput = {
    name: completeCartWorkflow.name,
    input: { cartId },
    retry: {},
    startToCloseTimeout: `${STEP_TIMEOUT_SECONDS} seconds`,
  }

  const handle = await client.workflow.start(PROTEUS_WORKFLOW_TYPE, {
    taskQueue: TEMPORAL_TASK_QUEUE,
    workflowId,
    args: [driver],
  })
  console.info(`› started ${workflowId}`)

  const before = await waitForCompletedSteps(workflowId, STEPS_BEFORE_STOP)
  console.info(`› ${before} step(s) done — ${hard ? 'SIGKILLing' : 'draining'} Worker #1 (pid ${worker.pid})`)

  await worker.stop(hard ? 'SIGKILL' : 'SIGTERM')
  worker = undefined

  console.info('› no Worker is running. The execution is now only in Temporal.')
  await delay(2_000)

  console.info('› starting Worker #2')
  worker = startWorker('#2')
  await worker.ready

  const outcome = await handle
    .result()
    .then((output) => ({ ok: true as const, output }))
    .catch((error: unknown) => ({ ok: false as const, error }))

  await report(workflowId, outcome)
} finally {
  await worker?.stop('SIGTERM')
  await connection.close()
  await shutdown()
}

type RunningWorker = {
  pid: number | undefined
  ready: Promise<void>
  stop: (signal: 'SIGTERM' | 'SIGKILL') => Promise<void>
}

/**
 * A real Worker in a real OS process, started the way `npm run worker` starts one.
 *
 * In-process would be easier and would prove nothing: the claim is that the execution survives
 * losing the process, so the process has to be losable. It inherits this script's environment, which
 * dotenvx has already decrypted, so both Workers and this script agree on the database.
 */
function startWorker(label: string): RunningWorker {
  // `node --import tsx`, not the tsx binary: npm hoists `.bin` to the repo root, and the path to it
  // is not something this script should have to know.
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/temporal/worker.ts'], {
    cwd: backend,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let announce: () => void = () => undefined
  let fail: (error: Error) => void = () => undefined
  const ready = new Promise<void>((resolve, reject) => {
    announce = resolve
    fail = reject
  })

  child.on('error', fail)
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) fail(new Error(`Worker ${label} exited with code ${code}`))
  })

  child.stdout.on('data', (chunk: Buffer) => {
    const text = chunk.toString()
    if (text.includes('polling')) announce()
    for (const line of text.trimEnd().split('\n')) console.info(`    worker${label} ${line}`)
  })
  // The SDK logs to stderr and most of it is routine; only the Worker's own lines are interesting.
  child.stderr.on('data', () => undefined)

  return {
    pid: child.pid,
    ready,
    stop: (signal) =>
      new Promise<void>((resolve) => {
        if (child.exitCode !== null) return resolve()
        child.once('exit', () => resolve())
        child.kill(signal)
      }),
  }
}

/** Polls history until the driver has recorded `count` completed steps. */
async function waitForCompletedSteps(workflowId: string, count: number): Promise<number> {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const done = (await completedSteps(workflowId)).length
    if (done >= count) return done
    await delay(100)
  }
  throw new Error(`Timed out waiting for ${count} completed steps`)
}

type CompletedStep = { step: string; identity: string; attempt: number }

/**
 * Which steps completed, and which Worker ran each — read out of Temporal's history rather than out
 * of anything this script kept, because the point is that the history is the record.
 *
 * `ActivityTaskStarted` carries the Worker's identity (`pid@host`); `ActivityTaskCompleted` carries
 * the step name, inside a payload encoded with the same converter production uses.
 */
async function completedSteps(workflowId: string): Promise<CompletedStep[]> {
  const history = await client.workflow.getHandle(workflowId).fetchHistory()
  const started = new Map<string, { identity: string; attempt: number }>()
  const steps: CompletedStep[] = []

  for (const event of history.events ?? []) {
    const start = event.activityTaskStartedEventAttributes
    if (start) {
      started.set(String(start.scheduledEventId), {
        identity: start.identity ?? '(unknown)',
        attempt: start.attempt ?? 1,
      })
      continue
    }

    const completed = event.activityTaskCompletedEventAttributes
    if (!completed) continue

    const payload = completed.result?.payloads?.[0]
    if (!payload) continue

    const decoded = payloadConverter.fromPayload<AdvanceWorkflowResult>(payload)
    if (decoded.done) continue

    const who = started.get(String(completed.scheduledEventId))
    steps.push({ step: decoded.step, identity: who?.identity ?? '(unknown)', attempt: who?.attempt ?? 1 })
  }

  return steps
}

async function report(workflowId: string, outcome: { ok: boolean; error?: unknown }): Promise<void> {
  const steps = await completedSteps(workflowId)
  const workers = [...new Set(steps.map((step) => step.identity))]

  console.info('')
  console.info(`  ${workflowId}`)
  console.info('')
  console.info('   # │ step                     │ ran on')
  console.info('  ───┼──────────────────────────┼────────────────────')
  for (const [index, step] of steps.entries()) {
    // Marked where the identity actually changes, not where the script asked for the stop: draining
    // lets the Worker finish what it had picked up, so it usually gets a few steps further.
    const handover = index > 0 && step.identity !== steps[index - 1]?.identity
    const marker = handover ? ' ←— a new Worker process from here' : ''
    console.info(`  ${String(index + 1).padStart(2)} │ ${step.step.padEnd(24)} │ ${step.identity}${marker}`)
  }
  console.info('')

  const names = steps.map((step) => step.step)
  const repeated = names.filter((name, index) => names.indexOf(name) !== index)

  console.info(`  ${steps.length} step(s) completed across ${workers.length} Worker process(es).`)
  console.info(
    repeated.length === 0
      ? '  No step ran twice: the second Worker resumed from the next uncompleted one.'
      : `  ✖ These steps ran more than once: ${[...new Set(repeated)].join(', ')}`,
  )

  if (outcome.ok) {
    console.info('  The workflow completed and returned the order.')
    return
  }

  const message = outcome.error instanceof Error ? outcome.error.message : String(outcome.error)
  console.info('')
  console.info(`  The workflow failed: ${message}`)
  if (hard) {
    console.info('  Expected with --hard. The step in flight died with its Worker, so it hit')
    console.info(`  startToCloseTimeout (${STEP_TIMEOUT_SECONDS}s), failed as a TimeoutFailure that names no`)
    console.info('  step, and the execution compensated instead of resuming. See ADR-0021.')
  }
}
