import { Client, Connection } from '@temporalio/client'
import { NativeConnection, Worker } from '@temporalio/worker'
import { ulid } from 'ulid'
import { completeCartWorkflow } from '../../src/workflows/cart/complete-cart.js'
import { createWorkflowActivities } from '../../src/temporal/activities.js'
import { PAYLOAD_CONVERTER_PATH, PROTEUS_WORKFLOW_TYPE, WORKFLOWS_PATH } from '../../src/temporal/config.js'
import { createWorkerContainer } from '../../src/temporal/container.js'
import { workflowRegistry } from '../../src/temporal/registry.js'
import type { DriverInput } from '../../src/temporal/types.js'
import { env } from '../../src/env.js'
import { seedCheckoutCart } from './checkout-cart.js'

/**
 * Measures what the O(n²) accumulation actually costs, so ADR-0021 can state a number rather than a
 * shape.
 *
 * The design under measurement: every `advanceWorkflow` call carries *every* prior step's output, so
 * step k's request re-ships outputs 1..k-1. `complete-cart` returns a whole `OrderDTO` at step 8 and
 * a `PaymentDTO` at step 12, and re-ships both on every advance after. Temporal enforces a hard
 * per-message gRPC limit — 2 MiB by default — so the binding constraint is the *largest single
 * request*, not the total, and the realistic failure is a large cart rather than a slow workflow.
 *
 * What it does: runs one real `complete-cart` per line-item count against the Compose Temporal, then
 * reads the execution's history and adds up the bytes Temporal actually encoded for each
 * `ActivityTaskScheduled` input. Nothing is modelled or read off the source — these are the payloads
 * that crossed the wire.
 *
 *   docker compose -f apps/backend/docker-compose.yml up -d --wait
 *   docker compose -f apps/backend/docker-compose.test.yml up -d --wait
 *   npm run --workspace=backend db:migrate:test
 *   npm run --workspace=backend measure:workflow-payload -- 1 10 25 50 100
 *
 * Against `.env.test` with `NODE_ENV=test`, not the dev environment. Two reasons, and the second is
 * the important one: the rows this writes are throwaway checkouts that belong in a disposable
 * database, and `NODE_ENV=development` registers the *real* Resend provider with the real key from
 * `.env.local` — so a run against dev emails an order confirmation to every faker address it
 * invented. `send-order-confirmation` swallows the resulting provider error either way, so the
 * measurement is unaffected.
 *
 * It uses the base `proteus_test` database, not the numbered ones vitest provisions, so it cannot
 * collide with a test run.
 */

/** Temporal's default `grpc-max-frame-length`. The number every measurement here is against. */
const GRPC_LIMIT_BYTES = 2 * 1024 * 1024

const LINE_ITEM_COUNTS = process.argv.slice(2).map(Number).filter(Boolean)
const counts = LINE_ITEM_COUNTS.length > 0 ? LINE_ITEM_COUNTS : [1, 10, 25, 50]

type Measurement = {
  lineItems: number
  /** One entry per `advanceWorkflow`/`compensateWorkflow` request, in order. */
  requests: number[]
  steps: number
}

const taskQueue = `proteus-measure-${process.pid}`
const { container, shutdown } = await createWorkerContainer()

const dataConverter = { payloadConverterPath: PAYLOAD_CONVERTER_PATH }
const namespace = env.TEMPORAL_NAMESPACE

const connection = await Connection.connect({ address: env.TEMPORAL_ADDRESS })
const client = new Client({ connection, namespace, dataConverter })
const nativeConnection = await NativeConnection.connect({ address: env.TEMPORAL_ADDRESS })

const worker = await Worker.create({
  connection: nativeConnection,
  namespace,
  taskQueue,
  workflowsPath: WORKFLOWS_PATH,
  dataConverter,
  activities: createWorkflowActivities({ container, registry: workflowRegistry }),
})

const running = worker.run()
void running.catch(() => undefined)

const measurements: Measurement[] = []

try {
  for (const lineItems of counts) {
    console.info(`\nseeding a cart with ${lineItems} line item(s)…`)
    const { cartId } = await seedCheckoutCart(container, { lineItems })

    const workflowId = `measure-${lineItems}-${ulid()}`

    /**
     * The driver input the adapter would have built. Constructed here rather than going through
     * `createTemporalWorkflowEngine` for one reason: the engine generates its own workflow id and
     * does not hand it back, and the history is the whole measurement.
     */
    const driver: DriverInput = {
      name: completeCartWorkflow.name,
      input: { cartId },
      retry: {},
      startToCloseTimeout: '120 seconds',
    }

    await client.workflow.execute(PROTEUS_WORKFLOW_TYPE, { taskQueue, workflowId, args: [driver] })

    const history = await client.workflow.getHandle(workflowId).fetchHistory()
    const requests: number[] = []

    for (const event of history.events ?? []) {
      const scheduled = event.activityTaskScheduledEventAttributes
      if (!scheduled) continue
      requests.push(payloadBytes(scheduled.input?.payloads ?? []))
    }

    measurements.push({ lineItems, requests, steps: requests.length })
    console.info(`  ${requests.length} activity request(s), largest ${format(Math.max(...requests))}`)
  }

  report(measurements)
} finally {
  worker.shutdown()
  await running.catch(() => undefined)
  await nativeConnection.close()
  await connection.close()
  await shutdown()
}

/** What Temporal counts against the frame limit: the encoded value plus its metadata. */
function payloadBytes(payloads: { data?: Uint8Array | null; metadata?: Record<string, Uint8Array> | null }[] = []) {
  return payloads.reduce((total, payload) => {
    const metadata = Object.entries(payload.metadata ?? {}).reduce(
      (bytes, [key, value]) => bytes + key.length + value.length,
      0,
    )
    return total + (payload.data?.length ?? 0) + metadata
  }, 0)
}

function format(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
}

function report(rows: Measurement[]): void {
  console.info('')
  console.info('complete-cart accumulated payload — real executions, bytes as encoded by Temporal')
  console.info('')
  console.info('  line items │ requests │  largest request │  total shipped │ % of 2 MiB limit')
  console.info('  ───────────┼──────────┼──────────────────┼────────────────┼─────────────────')

  for (const row of rows) {
    const largest = Math.max(...row.requests)
    const total = row.requests.reduce((sum, bytes) => sum + bytes, 0)
    const share = ((largest / GRPC_LIMIT_BYTES) * 100).toFixed(2)
    console.info(
      `  ${String(row.lineItems).padStart(10)} │ ${String(row.steps).padStart(8)} │ ${format(largest).padStart(16)} │ ${format(total).padStart(14)} │ ${share.padStart(15)}%`,
    )
  }

  const last = rows[rows.length - 1]
  if (last) {
    console.info('')
    console.info(`  Per-request profile at ${last.lineItems} line item(s) — request n carries outputs 1..n-1:`)
    console.info(`    ${last.requests.map((bytes, index) => `${index + 1}:${format(bytes)}`).join('  ')}`)
  }

  const first = rows[0]
  if (!first || !last || first === last) return

  // Straight line through the two ends: the per-item cost is the same DTO copied into the same
  // number of later requests, so growth in the largest request is linear in line items.
  const perItem = (Math.max(...last.requests) - Math.max(...first.requests)) / (last.lineItems - first.lineItems)
  const base = Math.max(...first.requests) - perItem * first.lineItems
  console.info('')
  console.info(`  Largest request grows by ~${format(Math.round(perItem))} per line item.`)
  console.info(`  It would reach the 2 MiB limit at ~${Math.round((GRPC_LIMIT_BYTES - base) / perItem)} line items.`)
  console.info('')
}
