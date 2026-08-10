# Kuron

Lightweight cron framework for Cloudflare Workers `scheduled` events.

## What it is

Kuron is a thin wrapper around Cloudflare Workers' native cron triggers (`ScheduledController`). It provides a Hono-inspired API for registering cron handlers with middleware support and typed cron patterns.

## What it is _not_

Kuron does **not** implement the `CronScheduler` port (`src/core/types/scheduler.ts`). That port is designed around persistent job queues with backing stores, upsert/remove semantics, workers, and monitoring UIs (e.g. BullMQ).

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

Cron patterns must also be registered in `wrangler.jsonc` under `triggers.crons` for Cloudflare to dispatch them.
