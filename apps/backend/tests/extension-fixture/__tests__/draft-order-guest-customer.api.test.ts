import { BigNumber } from '@core/bignumber.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { AdminOrderResponse } from '@proteus/http-schemas/admin'
import type { StoreCreateCartLineItemResponse, StoreCreateDraftOrderResponse } from '@proteus/http-schemas/store'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import draftOrderDefinitions from '../../../src/api/admin/draft-orders/definitions.js'
import orderDefinitions from '../../../src/api/admin/orders/definitions.js'
import cartDefinitions from '../../../src/api/store/carts/definitions.js'

const definitions = [...cartDefinitions, ...orderDefinitions, ...draftOrderDefinitions]

let api: TestApi

/** A Cart with one sneaker and only a city, sent to the shop as a draft: what a chat shopper hands over. */
const sendDraft = async ({ service }: Pick<Fixtures, 'service'>, regionId: string, variantId: string) => {
  const cart = await service.create.cart(api.container, { regionId, currencyCode: 'cop', email: null })
  await api.post<StoreCreateCartLineItemResponse>(`/store/carts/${cart.id}/line-items`, { variantId, quantity: 1 })
  await api.post(`/store/carts/${cart.id}`, {
    shippingAddress: { countryCode: 'co', city: 'Medellín', province: 'Antioquia' },
  })
  const sent = await api.post<StoreCreateDraftOrderResponse>(`/store/carts/${cart.id}/draft-order`)
  return sent.body.orderId
}

/** What the shop records on the draft once the shopper answers in the chat. */
const recordContact = (draftId: string, contact: { email?: string; phone: string; address1: string }) =>
  api.post(`/admin/draft-orders/${draftId}`, {
    ...(contact.email ? { email: contact.email } : {}),
    shippingAddress: { firstName: 'Camila', lastName: 'Restrepo', phone: contact.phone, address1: contact.address1 },
  })

const convert = (draftId: string, paymentAmount?: string) =>
  api.post<ApiErrorBody>(`/admin/draft-orders/${draftId}/convert-to-order`, paymentAmount ? { paymentAmount } : {})

test.describe('a converted draft becomes its shopper’s guest Customer', () => {
  test('creates the guest from the draft’s phone, links later drafts to it, saves each new address once', async ({
    createApi,
    factories,
    service,
    expect,
  }) => {
    api = await createApi({
      definitions,
      config: { projectConfig: { store: { draftOrders: true, draftOrderConvertRequiresContact: true } } },
    })
    const region = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    await factories.create.country({ id: 'co', regionId: region.id })
    const sneaker = await service.create.sellableVariant(api.container, {
      product: { title: 'Runner' },
      price: { amount: new BigNumber('100000'), currencyCode: 'cop' },
      inventory: { level: { stockedQuantity: 10 } },
    })
    const customerService = api.container.resolve(Modules.CUSTOMER)
    const customerOf = async (orderId: string) =>
      (await api.get<AdminOrderResponse>(`/admin/orders/${orderId}`)).body.order.customerId
    const digits = `300${Math.floor(Math.random() * 1e7)
      .toString()
      .padStart(7, '0')}`

    // No contact yet: the store needs one before it holds stock for the order.
    const first = await sendDraft({ service }, region.id, sneaker.variant.id)
    const refused = await convert(first)
    expect(refused.status).toBe(400)
    expect(refused.body).toMatchObject({ type: 'not_allowed', code: 'draft_order_contact_required' })

    // A payment the order can't take fails the conversion, and nothing it did for the shopper stays.
    await recordContact(first, { phone: `+57 ${digits}`, address1: 'Calle 10 # 20-30' })
    const tooMuch = await convert(first, '999999999')
    expect(tooMuch.status).toBeGreaterThanOrEqual(400)
    expect(await customerService.listCustomers({ phone: `57${digits}` })).toEqual([])

    // The phone the shop recorded makes the guest, with the confirmed address as its default.
    expect((await convert(first)).status).toBe(200)
    const guestId = await customerOf(first)
    const guest = await customerService.retrieveCustomer(guestId ?? '')
    expect(guest).toMatchObject({ hasAccount: false, email: null, phone: `57${digits}`, firstName: 'Camila' })
    expect(await customerService.listCustomerAddresses({ customerId: guest.id })).toMatchObject([
      { address1: 'Calle 10 # 20-30', city: 'Medellín', isDefaultShipping: true },
    ])

    // The same phone typed another way, the same door: the same guest, and no second copy of the address.
    const second = await sendDraft({ service }, region.id, sneaker.variant.id)
    await recordContact(second, { phone: `57 ${digits.slice(0, 3)}-${digits.slice(3)}`, address1: 'calle 10 # 20-30 ' })
    expect((await convert(second)).status).toBe(200)
    expect(await customerOf(second)).toBe(guest.id)
    expect(await customerService.listCustomerAddresses({ customerId: guest.id })).toHaveLength(1)

    // An email the guest hadn't given joins it, and a new door is saved beside the first, not over it.
    const third = await sendDraft({ service }, region.id, sneaker.variant.id)
    const email = `camila.${digits}@example.com`
    await recordContact(third, { email, phone: `+57${digits}`, address1: 'Carrera 43A # 1-50' })
    expect((await convert(third)).status).toBe(200)
    expect(await customerOf(third)).toBe(guest.id)
    expect(await customerService.retrieveCustomer(guest.id)).toMatchObject({ email, phone: `57${digits}` })
    expect(
      (await customerService.listCustomerAddresses({ customerId: guest.id })).map(
        ({ address1, isDefaultShipping }) => ({
          address1,
          isDefaultShipping,
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        { address1: 'Calle 10 # 20-30', isDefaultShipping: true },
        { address1: 'Carrera 43A # 1-50', isDefaultShipping: false },
      ]),
    )
  })
})
