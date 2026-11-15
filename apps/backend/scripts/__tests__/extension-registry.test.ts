import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from '@tests/setup/test-extend.js'
import {
  checkExtensions,
  discoverExtensions,
  type GenerateOptions,
  generateExtensionRegistry,
  readCoreNames,
  staleFiles,
  writeFiles,
} from '../generate-extension-registry.js'
import { BACKEND } from '../runtime-sources.js'

/**
 * Each step writes a small extensions folder and asks the generator what it makes of it, against
 * this backend's real core: the collisions that matter are with core's actual module keys and routes.
 */

let roots: string[] = []

test.beforeEach(() => {
  roots = []
  return () => {
    for (const root of roots) rmSync(root, { recursive: true, force: true })
  }
})

/** A fresh extensions folder holding `files`. */
function extensionsFolder(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'extensions-'))
  roots.push(root)
  write(root, files)
  return root
}

function write(root: string, files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
}

function options(root: string): GenerateOptions {
  return { backend: BACKEND, root, subscribers: false, command: 'extensions:generate' }
}

const core = readCoreNames(BACKEND)

/** Every problem a folder holding `files` raises, as its message. */
function problems(files: Record<string, string>): string[] {
  const discovered = discoverExtensions(options(extensionsFolder(files)))
  return [...discovered.problems, ...checkExtensions(discovered.extensions, core)].map((problem) => problem.message)
}

const route = (method: string, matcher: string, operationId: string) =>
  `export default [{ method: '${method}', matcher: '${matcher}', operationId: '${operationId}', tags: [], handler: GET, output }]`

test.describe('extensions:generate', () => {
  test('every name an extension adds carries its prefix and is its own', async ({ expect }) => {
    expect(
      problems({
        'pisos-dj/extension.ts': "export default defineExtension({ name: 'pisos-dj' })",
        'pisos-dj/keys.ts': "export const PisosDjModules = { SHIPPING: defineModuleKey<S>('pisos-dj.shipping') }",
        'pisos-dj/events.ts': "export const E = { QUOTED: defineEvent<P>({ name: 'pisos-dj.quoted' }) }",
        'pisos-dj/schemas/city.ts': "export const City = z.object({}).openapi('PisosDjCity')",
        'pisos-dj/api/store/shipping-cities/definitions.ts': route(
          'GET',
          '/store/shipping-cities',
          'pisosDjListCities',
        ),
        'pisos-dj/modules/shipping/models/city.ts':
          "export const pisosDjCityTable = pgTable('pisos_dj_cities', {})\nexport type PisosDjCity = typeof pisosDjCityTable.$inferSelect",
      }),
    ).toEqual([])

    // `schema.gen.ts` re-exports every model file with `export *`, so an unprefixed model name
    // passes today and clashes only once core adds the same name.
    expect(
      problems({
        'pisos-dj/keys.ts': "export const PisosDjModules = { SHIPPING: defineModuleKey<S>('shipping') }",
        'pisos-dj/events.ts': "export const E = { QUOTED: defineEvent<P>({ name: 'quote.requested' }) }",
        'pisos-dj/schemas/city.ts': "export const City = z.object({}).openapi('ShippingCity')",
        'pisos-dj/api/store/shipping-cities/definitions.ts': route('GET', '/store/shipping-cities', 'listCities'),
        'pisos-dj/modules/shipping/models/city.ts':
          "export const cityTable = pgTable('pisos_dj_cities', {})\nexport type City = typeof cityTable.$inferSelect",
      }),
    ).toEqual([
      'the module key "shipping" in extension "pisos-dj" does not start with "pisos-dj."',
      'the event "quote.requested" in extension "pisos-dj" does not start with "pisos-dj."',
      'the operation id "listCities" in extension "pisos-dj" does not start with "pisosDj"',
      'the OpenAPI component "ShippingCity" in extension "pisos-dj" does not start with "PisosDj"',
      'the exported model identifier "cityTable" in extension "pisos-dj" does not start with "pisosDj" or "PisosDj"',
      'the exported model identifier "City" in extension "pisos-dj" does not start with "pisosDj" or "PisosDj"',
    ])

    expect(problems({ 'pisos-dj/extension.ts': "export default defineExtension({ name: 'pisos' })" })).toEqual([
      'the manifest names the extension "pisos" but its folder is "pisos-dj"',
    ])

    // The container registers by key, so a collision would overwrite core's service without a word.
    // An extension named `store` passes the prefix check with `store.…`, which is why the collision is its own check.
    expect(problems({ 'store/keys.ts': "export const StoreModules = { X: defineModuleKey<S>('store') }" })).toContain(
      'the module key "store" is already core\'s',
    )

    expect(
      problems({
        'pisos/keys.ts': "export const PisosModules = { A: defineModuleKey<S>('pisos.dj') }",
        'pisos-dj/keys.ts': "export const PisosDjModules = { A: defineModuleKey<S>('pisos.dj') }",
      }),
    ).toContainEqual(expect.stringMatching(/^the module key "pisos\.dj" is declared twice/))
  })

  test('an extension route is a store or webhook route core does not already answer', async ({ expect }) => {
    expect(
      problems({ 'shop/api/store/carts/definitions.ts': route('GET', '/store/carts/:cartId', 'shopGetCart') }),
    ).toEqual([expect.stringMatching(/^GET \/store\/carts\/:cartId is the core route GET \/store\/carts\/:id \(/)])

    // `RoutesSorter` tries a static segment before a parameter, so this would take `featured` from core.
    expect(
      problems({
        'shop/api/store/products/definitions.ts': route('GET', '/store/products/featured', 'shopFeaturedProducts'),
      }),
    ).toEqual([
      expect.stringMatching(
        /^GET \/store\/products\/featured would shadow the core route GET \/store\/products\/:handle/,
      ),
    ])

    expect(
      problems({
        'shop/api/store/products/definitions.ts': route('DELETE', '/store/products/featured', 'shopDropFeatured'),
      }),
    ).toEqual([])

    expect(
      problems({ 'shop/api/admin/rates/definitions.ts': route('GET', '/admin/shop-rates', 'shopListRates') }),
    ).toEqual(['extension "shop" declares the admin route GET /admin/shop-rates'])

    expect(problems({ 'shop/api/store/rates/definitions.ts': route('GET', '/rates', 'shopListRates') })).toEqual([
      'GET /rates is in api/store/ but does not start with /store/',
    ])
  })

  test('a hook takes one handler, whatever each file calls it', async ({ expect }) => {
    expect(
      problems({
        'pisos/hooks/charges.ts':
          "import { orderChargesHook } from '@workflows/order/hooks.js'\nexport const handler = defineHookHandler(orderChargesHook, { run })",
        'shop/hooks/charges.ts':
          "import { orderChargesHook as charges } from '@workflows/order/hooks.js'\nexport const handler = defineHookHandler(charges, { run })",
      }),
    ).toEqual([expect.stringMatching(/^a second handler for the hook orderChargesHook — the first is at /)])
  })

  test('a fulfillment provider’s identifier carries the snake prefix and is not core’s', async ({ expect }) => {
    const provider = (identifier: string) =>
      `class Rates extends AbstractFulfillmentProvider { static identifier = '${identifier}' }\nexport default ModuleProvider(Modules.FULFILLMENT, { services: [Rates] })`

    expect(problems({ 'pisos-dj/providers/fulfillment/rates.ts': provider('pisos_dj_rates') })).toEqual([])

    // It becomes a `fulfillment_provider` row id, so it takes the database form of the prefix.
    expect(problems({ 'pisos-dj/providers/fulfillment/rates.ts': provider('pisos-dj.rates') })).toEqual([
      'the fulfillment provider identifier "pisos-dj.rates" in extension "pisos-dj" does not start with "pisos_dj_"',
    ])

    // An extension named `manual` passes the prefix check with `manual_…`, but not with core's own.
    expect(problems({ 'manual/providers/fulfillment/rates.ts': provider('manual') })).toEqual([
      'the fulfillment provider identifier "manual" in extension "manual" does not start with "manual_"',
      'the fulfillment provider identifier "manual" is already core\'s',
    ])

    // An identifier built at runtime cannot be checked, so it is refused.
    expect(
      problems({
        'shop/providers/fulfillment/rates.ts':
          'class Rates { static identifier = ID }\nexport default ModuleProvider(Modules.FULFILLMENT, { services: [Rates] })',
      }),
    ).toEqual(['a fulfillment provider file declaring no class with a string-literal `static identifier`'])
  })

  test('renders an extension’s fulfillment providers into the registry', async ({ expect }) => {
    const root = extensionsFolder({
      'shop/providers/fulfillment/rates.ts':
        "class Rates { static identifier = 'shop_rates' }\nexport default ModuleProvider(Modules.FULFILLMENT, { services: [Rates] })",
    })
    const generated = await generateExtensionRegistry(options(root))

    expect(generated.problems).toEqual([])
    expect(generated.files[0]?.content).toContain(
      "import shopRatesFulfillmentProvider from './shop/providers/fulfillment/rates.js'",
    )
    expect(generated.files[0]?.content).toContain("{ extension: 'shop', resolve: shopRatesFulfillmentProvider }")
  })

  /** `--check` is what verify runs: a file added without regenerating is caught, not shipped. */
  test('reports a registry gone stale when an extension gains a module', async ({ expect }) => {
    const root = extensionsFolder({ 'shop/extension.ts': "export default defineExtension({ name: 'shop' })" })
    const first = await generateExtensionRegistry(options(root))
    expect(first.problems).toEqual([])
    writeFiles(first.files)
    expect(staleFiles(first.files)).toEqual([])

    write(root, { 'shop/modules/rates/index.ts': 'export default Module(ShopModules.RATES, {})' })
    const second = await generateExtensionRegistry(options(root))

    expect(staleFiles(second.files).map((file) => file.path)).toEqual([join(root, 'registry.gen.ts')])
    expect(second.files[0]?.content).toContain("import shopRatesModule from './shop/modules/rates/index.js'")
  })
})
