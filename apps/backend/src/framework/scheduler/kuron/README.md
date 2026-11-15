# Kuron

Lightweight cron framework for Cloudflare Workers `scheduled` events.

## What it is

Kuron is a thin wrapper around Cloudflare Workers' native cron triggers (`ScheduledController`). It provides a Hono-inspired API for registering cron handlers with middleware support and typed cron patterns.

## What it is _not_

Kuron does **not** implement the `CronScheduler` port (`src/core/types/scheduler.ts`). That port is designed around a persistent backing store with upsert/remove semantics and a separate worker process — today, Temporal Schedules and the cron Worker.

Kuron has none of that. CF Workers cron triggers are defined declaratively in `wrangler.jsonc` and dispatched by Cloudflare's infrastructure. Kuron just routes incoming `scheduled` events to the right handler.

## Usage

```ts
import { Cron } from './framework/scheduler/kuron/index.js'

const cron = new Cron()

cron.schedule('* * * * *', async (c) => {
  console.log('Runs every minute')
})

cron.use(async (c, next) => {
  console.log(`[${c.cron}] Job "${c.name}" starting`)
  await next()
})

export default {
  fetch: app.fetch,
  scheduled: cron.scheduled,
}
```

Cloudflare dispatches only the patterns listed in `wrangler.jsonc` under `triggers.crons`. That list is generated: `pnpm --filter backend run jobs:generate` writes one entry per distinct schedule of the enabled jobs (core's and the extensions'), and `check:workerd-crons` fails `pnpm run verify` when it drifts. See `scripts/generate-workerd-crons.ts`.
