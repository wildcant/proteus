import type { EventBus } from '@core/event-bus/types.js'
import type { Logger } from '@core/types/logger.js'
import { ContainerRegistrationKeys } from '@core/utils/index.js'
import type { HttpRequest } from '@framework/http/ports.js'
import { type RouteDefinition, Tags } from '@framework/http/types.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { z } from 'zod'
import { noopLogger } from '../../../core/logger/noop-logger.js'

/**
 * The whole arc, through the surface a shopper's request actually travels: a route handler
 * publishes, the bus derives the dispatch identity, the generated registry answers with the
 * subscribers that asked for the event, and the subscriber function runs against the same container
 * the handler resolved from.
 *
 * The route is defined here rather than mounted from `src/api/`, because no production route
 * publishes yet — the webhook that will is a later ticket, and adding one now would be a route
 * nothing calls. `createApi` takes definitions, so the arc is exercised through the real sorter,
 * the real middleware and a listening server without inventing an endpoint the API has to keep.
 *
 * The outcome asserted is the probe's log line, and the line is the assertion: it carries the
 * dispatch identity, which is the event name, the key derived from the payload and the subscriber's
 * own name — none of which the call site below supplies or could get wrong.
 */

const logged: string[] = []
const recordingLogger: Logger = {
  ...noopLogger,
  info(message) {
    logged.push(message)
  },
}
const testWithLog = test.extend<Pick<Fixtures, 'logger'>>({
  async logger({ task: _ }, use) {
    await use(recordingLogger)
  },
})

const PublishBody = z.object({ id: z.string() })
const PublishOutput = z.object({ published: z.boolean() })

const publishDefinitions: RouteDefinition[] = [
  {
    method: 'POST',
    matcher: '/test/publish',
    input: { body: PublishBody },
    output: PublishOutput,
    operationId: 'publishProbeEvent',
    tags: [Tags.WEBHOOKS],
    handler: async (request: HttpRequest) => {
      const bus = request.scope.resolve<EventBus>(ContainerRegistrationKeys.EVENT_BUS)
      const { id } = PublishBody.parse(request.body)

      await bus.emit('bus.probe', { id })

      return { status: 200, json: { published: true } }
    },
  },
]

test.describe('publishing from a request', () => {
  testWithLog('reaches the subscriber the generated registry names', async ({ createApi, expect }) => {
    logged.length = 0
    const api = await createApi({ definitions: publishDefinitions })

    const { status, body } = await api.post<typeof PublishOutput>('/test/publish', { id: 'ord_arc' })

    expect(status).toBe(200)
    expect(body.published).toBe(true)
    expect(logged).toContain('[bus-probe] bus.probe:ord_arc:bus-probe')
  })

  testWithLog(
    'derives a second identity for a repeat of an event that may fire twice',
    async ({ createApi, expect }) => {
      logged.length = 0
      const api = await createApi()
      const bus = api.container.resolve<EventBus>(ContainerRegistrationKeys.EVENT_BUS)

      await bus.emit('bus.probe.repeatable', { id: 'ord_arc', attempt: 1 })
      await bus.emit('bus.probe.repeatable', { id: 'ord_arc', attempt: 2 })

      expect(logged).toEqual([
        '[bus-probe] bus.probe.repeatable:ord_arc:1:bus-probe',
        '[bus-probe] bus.probe.repeatable:ord_arc:2:bus-probe',
      ])
    },
  )
})
