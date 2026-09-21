import { randomUUID } from 'node:crypto'
import type { TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import customerDefinitions from '../definitions.js'
import type * as customerRoutes from '../route.js'

type Services = Fixtures['service']

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: customerDefinitions })
})

const listCustomers = (query: Record<string, unknown>) =>
  api.get<typeof customerRoutes.GetOutput>('/admin/customers', undefined, { query })

/** Two customers nobody else's rows can collide with, so `q` can be asserted on exact membership. */
const createPair = async (service: Services, tag: string) => {
  const ada = await service.create.customer(api.container, {
    firstName: `Ada${tag}`,
    lastName: 'Lovelace',
    email: `ada.${tag}@example.com`,
  })
  const grace = await service.create.customer(api.container, {
    firstName: 'Grace',
    lastName: `Hopper${tag}`,
    email: `grace.${tag}@example.com`,
  })
  return { ada, grace }
}

test.describe('GET /admin/customers', () => {
  test('searches across both name halves and the email, and narrows the result by created date', async ({
    expect,
    service,
  }) => {
    const tag = randomUUID().slice(0, 8)
    const { ada, grace } = await createPair(service, tag)

    // The tag is in every column the route declares searchable, so this is the whole pair.
    const both = await listCustomers({ q: tag })
    expect(both.status).toBe(200)
    expect(both.body.customers.map((customer) => customer.id).sort()).toEqual([ada.id, grace.id].sort())
    expect(both.body.count).toBe(2)

    const byFirstName = await listCustomers({ q: `Ada${tag}` })
    expect(byFirstName.body.customers.map((customer) => customer.id)).toEqual([ada.id])

    const byLastName = await listCustomers({ q: `Hopper${tag}` })
    expect(byLastName.body.customers.map((customer) => customer.id)).toEqual([grace.id])

    const byEmail = await listCustomers({ q: `grace.${tag}@example.com` })
    expect(byEmail.body.customers.map((customer) => customer.id)).toEqual([grace.id])

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const createdLater = await listCustomers({ q: tag, createdAt: { $gte: tomorrow } })
    expect(createdLater.body.customers).toEqual([])

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const createdRecently = await listCustomers({ q: tag, createdAt: { $gte: yesterday } })
    expect(createdRecently.body.count).toBe(2)
  })
})
