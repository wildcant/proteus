import type {
  DeleteResponse,
  StoreCustomerAddressListResponse,
  StoreCustomerAddressResponse,
  StoreUpdateAddressBody,
} from '@proteus/http-schemas/store'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import { authHeader } from '@tests/utils/auth-header.js'
import customerDefinitions from '../definitions.js'

let api: TestApi

// `namespaceAuth` mounts the real `authenticate` middleware, which is the subject of half this
// file: the routes are named `/me/...` but the id in the path is whatever was typed.
test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: customerDefinitions, namespaceAuth: true })
})

const list = (headers?: Record<string, string>) =>
  api.get<StoreCustomerAddressListResponse | ApiErrorBody>('/store/customers/me/addresses', undefined, { headers })

// `object` rather than `StoreCreateAddressBody`, matching the verb this wraps: one test's whole
// subject is a body the schema must reject, and it should not have to bypass the helper to send
// one. Valid bodies get their typing from `http.store.createAddress`, not from here.
const create = (body: object, headers?: Record<string, string>) =>
  api.post<StoreCustomerAddressResponse | ApiErrorBody>('/store/customers/me/addresses', body, { headers })

const update = (addressId: string, body: StoreUpdateAddressBody, headers?: Record<string, string>) =>
  api.patch<StoreCustomerAddressResponse | ApiErrorBody>(`/store/customers/me/addresses/${addressId}`, body, {
    headers,
  })

const remove = (addressId: string, headers?: Record<string, string>) =>
  api.delete<DeleteResponse | ApiErrorBody>(`/store/customers/me/addresses/${addressId}`, undefined, { headers })

test.describe('GET /store/customers/me/addresses', () => {
  test('refuses a guest', async ({ expect }) => {
    const { status, body } = await list()

    expect(status).toBe(401)
    expect(body).toMatchObject({ type: 'unauthorized' })
  })

  test("returns only the authenticated customer's addresses", async ({ service, expect }) => {
    // A second customer with an address of their own is what makes the filter observable:
    // without one an unfiltered read returns the same single row and the test cannot fail.
    const customer = await service.create.customer(api.container)
    const other = await service.create.customer(api.container)
    const mine = await service.create.customerAddress(api.container, customer.id)
    await service.create.customerAddress(api.container, other.id)

    const { status, body } = await list(authHeader('customer', customer.id))

    expect(status).toBe(200)
    expect(body).toMatchObject({ addresses: [{ id: mine.id }] })
  })

  test('leaves out an address that was deleted', async ({ service, expect }) => {
    const customer = await service.create.customer(api.container)
    const kept = await service.create.customerAddress(api.container, customer.id)
    const removed = await service.create.customerAddress(api.container, customer.id)

    await remove(removed.id, authHeader('customer', customer.id))
    const { body } = await list(authHeader('customer', customer.id))

    const ids = 'addresses' in body ? body.addresses.map((address) => address.id) : []
    expect(ids).toEqual([kept.id])
  })
})

test.describe('POST /store/customers/me/addresses', () => {
  test('refuses a guest', async ({ expect, http }) => {
    const { status, body } = await create(http.store.createAddress())

    expect(status).toBe(401)
    expect(body).toMatchObject({ type: 'unauthorized' })
  })

  test('saves the address against the caller, not against a customer id in the body', async ({
    service,
    expect,
    http,
  }) => {
    const customer = await service.create.customer(api.container)

    const { status, body } = await create(
      http.store.createAddress({ addressName: 'Home', firstName: 'Ada' }),
      authHeader('customer', customer.id),
    )

    expect(status).toBe(201)
    expect(body).toMatchObject({ address: { customerId: customer.id, addressName: 'Home', firstName: 'Ada' } })
  })

  test('rejects an address a courier could not deliver to', async ({ service, expect }) => {
    const customer = await service.create.customer(api.container)

    const { status, body } = await create({ firstName: 'Ada' }, authHeader('customer', customer.id))

    expect(status).toBe(400)
    expect(body).toMatchObject({ type: 'invalid_data' })
  })

  test('a new default releases the address that held the slot', async ({ service, expect, http }) => {
    const customer = await service.create.customer(api.container)
    const first = await service.create.customerAddress(api.container, customer.id)
    await update(first.id, { isDefault: true }, authHeader('customer', customer.id))

    const { status, body } = await create(
      http.store.createAddress({ isDefault: true }),
      authHeader('customer', customer.id),
    )

    // The partial unique indexes make a second default a database error, so a route that
    // set the flag without clearing the previous holder would 500 here.
    expect(status).toBe(201)
    expect(body).toMatchObject({ address: { isDefaultShipping: true, isDefaultBilling: true } })

    const addresses = await service.read.customerAddresses(api.container, { customerId: customer.id })
    const defaults = addresses.filter((address) => address.isDefaultShipping || address.isDefaultBilling)
    expect(defaults.map((address) => address.id)).toEqual(['address' in body ? body.address.id : 'the created address'])
  })

  test('a default is scoped to its customer, so two customers can each have one', async ({ service, expect, http }) => {
    const customer = await service.create.customer(api.container)
    const other = await service.create.customer(api.container)

    await create(http.store.createAddress({ isDefault: true }), authHeader('customer', customer.id))
    const { status } = await create(http.store.createAddress({ isDefault: true }), authHeader('customer', other.id))

    expect(status).toBe(201)
  })
})

test.describe('PATCH /store/customers/me/addresses/:id', () => {
  test("refuses to edit another customer's address", async ({ service, expect }) => {
    const owner = await service.create.customer(api.container)
    const intruder = await service.create.customer(api.container)
    const address = await service.create.customerAddress(api.container, owner.id, { city: 'Austin' })

    const { status, body } = await update(address.id, { city: 'Springfield' }, authHeader('customer', intruder.id))

    // 404 rather than 403, matching the order detail route: probing ids reveals nothing.
    expect(status).toBe(404)
    expect(body).toMatchObject({ type: 'not_found' })

    const [unchanged] = await service.read.customerAddresses(api.container, { id: address.id })
    expect(unchanged?.city).toBe('Austin')
  })

  test('updates an address the caller owns', async ({ service, expect }) => {
    const customer = await service.create.customer(api.container)
    const address = await service.create.customerAddress(api.container, customer.id)

    const { status, body } = await update(
      address.id,
      { city: 'Springfield', addressName: 'Work' },
      authHeader('customer', customer.id),
    )

    expect(status).toBe(200)
    expect(body).toMatchObject({ address: { id: address.id, city: 'Springfield', addressName: 'Work' } })
  })

  test('promoting one address demotes the one that was default', async ({ service, expect }) => {
    const customer = await service.create.customer(api.container)
    const wasDefault = await service.create.customerAddress(api.container, customer.id)
    const promoted = await service.create.customerAddress(api.container, customer.id)
    await update(wasDefault.id, { isDefault: true }, authHeader('customer', customer.id))

    const { status } = await update(promoted.id, { isDefault: true }, authHeader('customer', customer.id))

    expect(status).toBe(200)
    const addresses = await service.read.customerAddresses(api.container, { customerId: customer.id })
    const flags = new Map(addresses.map((address) => [address.id, address.isDefaultShipping]))
    expect(flags.get(promoted.id)).toBe(true)
    expect(flags.get(wasDefault.id)).toBe(false)
  })

  test('unchecking the default leaves the customer with none', async ({ service, expect }) => {
    const customer = await service.create.customer(api.container)
    const address = await service.create.customerAddress(api.container, customer.id)
    await update(address.id, { isDefault: true }, authHeader('customer', customer.id))

    const { body } = await update(address.id, { isDefault: false }, authHeader('customer', customer.id))

    expect(body).toMatchObject({ address: { isDefaultShipping: false, isDefaultBilling: false } })
  })

  test('a promotion is not blocked by a default that was deleted', async ({ service, expect }) => {
    const customer = await service.create.customer(api.container)
    const retired = await service.create.customerAddress(api.container, customer.id)
    const replacement = await service.create.customerAddress(api.container, customer.id)
    await update(retired.id, { isDefault: true }, authHeader('customer', customer.id))
    await remove(retired.id, authHeader('customer', customer.id))

    // Both unique indexes are filtered on the live rows, so the soft-deleted default does not
    // hold the slot. A plain unique index would fail this with a constraint violation.
    const { status } = await update(replacement.id, { isDefault: true }, authHeader('customer', customer.id))

    expect(status).toBe(200)
  })
})

test.describe('DELETE /store/customers/me/addresses/:id', () => {
  test("refuses to delete another customer's address", async ({ service, expect }) => {
    const owner = await service.create.customer(api.container)
    const intruder = await service.create.customer(api.container)
    const address = await service.create.customerAddress(api.container, owner.id)

    const { status, body } = await remove(address.id, authHeader('customer', intruder.id))

    expect(status).toBe(404)
    expect(body).toMatchObject({ type: 'not_found' })

    const survivors = await service.read.customerAddresses(api.container, { customerId: owner.id })
    expect(survivors.map((survivor) => survivor.id)).toEqual([address.id])
  })

  test('deletes an address the caller owns', async ({ service, expect }) => {
    const customer = await service.create.customer(api.container)
    const address = await service.create.customerAddress(api.container, customer.id)

    const { status, body } = await remove(address.id, authHeader('customer', customer.id))

    expect(status).toBe(200)
    expect(body).toMatchObject({ id: address.id, deleted: true })
    expect(await service.read.customerAddresses(api.container, { customerId: customer.id })).toEqual([])
  })
})
