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

/**
 * A shopper who buys through a chat may give only a phone. The admin records them as a guest with
 * either contact, keeps the phone as digits whatever way it was typed, and finds them by it.
 */
test.describe('a guest Customer with a phone', () => {
  test('is created with a phone alone, stored as digits, found by it, and refused with no contact', async ({
    expect,
  }) => {
    const digits = `300${Math.floor(Math.random() * 1e7)
      .toString()
      .padStart(7, '0')}`
    const typed = `+57 ${digits.slice(0, 3)} ${digits.slice(3)}`

    const created = await api.post<typeof customerRoutes.PostOutput>('/admin/customers', [
      { firstName: 'Camila', lastName: 'Restrepo', phone: typed },
    ])
    expect(created.status).toBe(201)
    expect(created.body.customers).toMatchObject([{ email: null, phone: `57${digits}`, hasAccount: false }])

    const found = await listCustomers({ q: digits })
    expect(found.body.customers.map((customer) => customer.phone)).toEqual([`57${digits}`])

    // The same number typed another way is the same guest, so a second one is refused.
    const twice = await api.post('/admin/customers', [{ firstName: 'Camila', lastName: 'R', phone: `57${digits}` }])
    expect(twice.status).toBe(422)

    const noContact = await api.post('/admin/customers', [{ firstName: 'Nadie', lastName: 'Contacto' }])
    expect(noContact.status).toBe(400)
  })
})
