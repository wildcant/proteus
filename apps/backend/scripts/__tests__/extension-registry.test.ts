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
 * Each case writes a small extensions folder and asks the generator what it makes of it, against
 * this backend's real core: the collisions that matter are with core's actual module keys and routes.
 */

let root: string

test.beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'extensions-'))
  return () => rmSync(root, { recursive: true, force: true })
})

function write(files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
}

function options(): GenerateOptions {
  return { backend: BACKEND, root, subscribers: false, command: 'extensions:generate' }
}

const core = readCoreNames(BACKEND)

/** Every problem the folder raises, as its message. */
function problems(files: Record<string, string>): string[] {
  write(files)
  const discovered = discoverExtensions(options())
  return [...discovered.problems, ...checkExtensions(discovered.extensions, core)].map((problem) => problem.message)
}

const route = (method: string, matcher: string, operationId: string) =>
  `export default [{ method: '${method}', matcher: '${matcher}', operationId: '${operationId}', tags: [], handler: GET, output }]`

test.describe('extensions:generate', () => {
  test('accepts an extension whose names are prefixed and whose routes are its own', async ({ expect }) => {
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
      }),
    ).toEqual([])
  })

  test('rejects names without the extension’s prefix, in each namespace', async ({ expect }) => {
    const found = problems({
      'pisos-dj/keys.ts': "export const PisosDjModules = { SHIPPING: defineModuleKey<S>('shipping') }",
      'pisos-dj/events.ts': "export const E = { QUOTED: defineEvent<P>({ name: 'quote.requested' }) }",
      'pisos-dj/schemas/city.ts': "export const City = z.object({}).openapi('ShippingCity')",
      'pisos-dj/api/store/shipping-cities/definitions.ts': route('GET', '/store/shipping-cities', 'listCities'),
    })

    expect(found).toEqual([
      'the module key "shipping" in extension "pisos-dj" does not start with "pisos-dj."',
      'the event "quote.requested" in extension "pisos-dj" does not start with "pisos-dj."',
      'the operation id "listCities" in extension "pisos-dj" does not start with "pisosDj"',
      'the OpenAPI component "ShippingCity" in extension "pisos-dj" does not start with "PisosDj"',
    ])
  })

  test('rejects a manifest that names another extension than its folder', async ({ expect }) => {
    expect(problems({ 'pisos-dj/extension.ts': "export default defineExtension({ name: 'pisos' })" })).toEqual([
      'the manifest names the extension "pisos" but its folder is "pisos-dj"',
    ])
  })

  /** The container registers by key, so a collision would overwrite core's service without a word. */
  test('rejects a module key core already has', async ({ expect }) => {
    // An extension named `cart` passes the prefix check with `cart.…`, which is why the collision is its own check.
    expect(problems({ 'store/keys.ts': "export const StoreModules = { X: defineModuleKey<S>('store') }" })).toContain(
      'the module key "store" is already core\'s',
    )
  })

  test('rejects a second extension declaring the same module key', async ({ expect }) => {
    expect(
      problems({
        'pisos/keys.ts': "export const PisosModules = { A: defineModuleKey<S>('pisos.dj') }",
        'pisos-dj/keys.ts': "export const PisosDjModules = { A: defineModuleKey<S>('pisos.dj') }",
      }).some((message) => message.startsWith('the module key "pisos.dj" is declared twice')),
    ).toBe(true)
  })

  test('rejects a route core already serves, whatever its parameter is called', async ({ expect }) => {
    expect(
      problems({ 'shop/api/store/carts/definitions.ts': route('GET', '/store/carts/:cartId', 'shopGetCart') }),
    ).toEqual([expect.stringMatching(/^GET \/store\/carts\/:cartId is the core route GET \/store\/carts\/:id \(/)])
  })

  /** `RoutesSorter` tries a static segment before a parameter, so this would take `featured` from core. */
  test('rejects a static path in front of a core parameter route', async ({ expect }) => {
    const found = problems({
      'shop/api/store/products/definitions.ts': route('GET', '/store/products/featured', 'shopFeaturedProducts'),
    })

    expect(found).toEqual([
      expect.stringMatching(
        /^GET \/store\/products\/featured would shadow the core route GET \/store\/products\/:handle/,
      ),
    ])
  })

  test('accepts a parameter route core’s static routes sort in front of, and another method', async ({ expect }) => {
    expect(
      problems({
        'shop/api/store/products/definitions.ts': route('DELETE', '/store/products/featured', 'shopDropFeatured'),
      }),
    ).toEqual([])
  })

  test('rejects an admin route, saying why', async ({ expect }) => {
    expect(
      problems({ 'shop/api/admin/rates/definitions.ts': route('GET', '/admin/shop-rates', 'shopListRates') }),
    ).toEqual(['extension "shop" declares the admin route GET /admin/shop-rates'])
  })

  test('rejects a route outside the prefix its folder promises', async ({ expect }) => {
    expect(problems({ 'shop/api/store/rates/definitions.ts': route('GET', '/rates', 'shopListRates') })).toEqual([
      'GET /rates is in api/store/ but does not start with /store/',
    ])
  })

  test('rejects a second handler for one hook, whatever each file calls it', async ({ expect }) => {
    const found = problems({
      'pisos/hooks/charges.ts':
        "import { orderChargesHook } from '@workflows/order/hooks.js'\nexport const handler = defineHookHandler(orderChargesHook, { run })",
      'shop/hooks/charges.ts':
        "import { orderChargesHook as charges } from '@workflows/order/hooks.js'\nexport const handler = defineHookHandler(charges, { run })",
    })

    expect(found).toEqual([expect.stringMatching(/^a second handler for the hook orderChargesHook — the first is at /)])
  })

  /** `--check` is what verify runs: a file added without regenerating is caught, not shipped. */
  test('reports a registry gone stale when an extension gains a module', async ({ expect }) => {
    write({ 'shop/extension.ts': "export default defineExtension({ name: 'shop' })" })
    const first = await generateExtensionRegistry(options())
    expect(first.problems).toEqual([])
    writeFiles(first.files)
    expect(staleFiles(first.files)).toEqual([])

    write({ 'shop/modules/rates/index.ts': 'export default Module(ShopModules.RATES, {})' })
    const second = await generateExtensionRegistry(options())

    expect(staleFiles(second.files).map((file) => file.path)).toEqual([join(root, 'registry.gen.ts')])
    expect(second.files[0]?.content).toContain("import shopRatesModule from './shop/modules/rates/index.js'")
  })
})
