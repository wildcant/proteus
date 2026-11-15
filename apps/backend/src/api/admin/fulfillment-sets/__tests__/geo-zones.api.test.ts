import { Modules } from '@core/utils/modules-definition.js'
import type { AdminCreateGeoZoneResponse, AdminCreateServiceZoneResponse } from '@proteus/http-schemas/admin'
import type { StoreShippingOptionListResponse } from '@proteus/http-schemas/store'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import cartDefinitions from '../../../store/carts/definitions.js'
import fulfillmentSetDefinitions from '../definitions.js'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: [...fulfillmentSetDefinitions, ...cartDefinitions] })
})

const medellin = { countryCode: 'co', provinceCode: 'Antioquia', city: 'Medellín' }

/**
 * Each geo zone type narrows the one above it, so a zone missing a field its type needs could never
 * match an address. Such a zone is refused when it is created, nested in a service zone or on its
 * own; a complete postal-code zone is stored, and serves only its postal code.
 */
test('refuses a geo zone that could never match, and a postal-code zone serves its code alone', async ({
  factories,
  service,
  expect,
}) => {
  // The option is zoned to Japan, so only the zones created below can offer it to a Colombian cart.
  const option = await factories.create.shippingOptionWithZone({ geoZone: { countryCode: 'jp' } })
  const geoZonesPath = `/admin/fulfillment-sets/${option.fulfillmentSet.id}/service-zones/${option.serviceZone.id}/geo-zones`
  const createGeoZone = (body: Record<string, unknown>) =>
    api.post<AdminCreateGeoZoneResponse | ApiErrorBody>(geoZonesPath, body)

  const cityWithoutProvince = await createGeoZone({ type: 'city', countryCode: 'co', city: 'Medellín' })
  expect(cityWithoutProvince.status).toBe(400)
  expect(cityWithoutProvince.body).toMatchObject({ type: 'invalid_data' })

  const zipWithoutCity = await createGeoZone({
    type: 'zip',
    countryCode: 'co',
    provinceCode: 'Antioquia',
    postalExpression: '050001',
  })
  expect(zipWithoutCity.status).toBe(400)
  expect(zipWithoutCity.body).toMatchObject({ type: 'invalid_data' })

  const provinceWithoutCode = await createGeoZone({ type: 'province', countryCode: 'co', provinceCode: '  ' })
  expect(provinceWithoutCode.status).toBe(400)

  // Nested in a new service zone: refused whole, so no half-made zone is left behind.
  const nested = await api.post<AdminCreateServiceZoneResponse | ApiErrorBody>(
    `/admin/fulfillment-sets/${option.fulfillmentSet.id}/service-zones`,
    { name: 'Medellín', geoZones: [{ type: 'zip', ...medellin }] },
  )
  expect(nested.status).toBe(400)
  const fulfillmentService = api.container.resolve(Modules.FULFILLMENT)
  expect(await fulfillmentService.listServiceZones({ fulfillmentSetId: option.fulfillmentSet.id })).toHaveLength(1)

  const zip = await createGeoZone({ type: 'zip', ...medellin, postalExpression: '050001' })
  expect(zip.status).toBe(201)

  const listFor = async (postalCode: string) => {
    const cart = await service.create.cart(api.container)
    await service.create.cartAddresses(api.container, cart.id, {
      shippingAddress: { countryCode: 'CO', province: 'antioquia', city: 'Medellín ', postalCode },
      billingAddress: undefined,
    })
    const { body } = await api.get<StoreShippingOptionListResponse>(`/store/carts/${cart.id}/shipping-options`)
    return body.shippingOptions.map((listed) => listed.id)
  }

  expect(await listFor('050001')).toEqual([option.id])
  expect(await listFor('050002')).toEqual([])
})
