import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { BigNumber } from '../src/core/bignumber.js'
import { buildEvent } from '../src/core/event-bus/events.js'
import { defineSubscriber } from '../src/core/event-bus/types.js'
import type { IAuthModuleService } from '../src/core/types/auth/service.js'
import type { ICartModuleService } from '../src/core/types/cart/service.js'
import type { ICustomerModuleService } from '../src/core/types/customer/service.js'
import type { IFileModuleService } from '../src/core/types/file/service.js'
import type { IFulfillmentModuleService } from '../src/core/types/fulfillment/service.js'
import type { IInventoryModuleService } from '../src/core/types/inventory/service.js'
import type { ILinkService } from '../src/core/types/link/service.js'
import type { INotificationModuleService } from '../src/core/types/notification/service.js'
import type { IPaymentModuleService } from '../src/core/types/payment/service.js'
import type { IProductModuleService } from '../src/core/types/product/service.js'
import type { IRegionModuleService } from '../src/core/types/region/service.js'
import type { IStockLocationModuleService } from '../src/core/types/stock-location/service.js'
import type { IStoreModuleService } from '../src/core/types/store/service.js'
import type { IUserModuleService } from '../src/core/types/user/service.js'
import { ContainerRegistrationKeys } from '../src/core/utils/container.js'
import { Modules } from '../src/core/utils/modules-definition.js'
import { createWorkerContainer } from '../src/framework/runtime/container.worker.js'
import type { AccessControlModuleService } from '../src/modules/access-control/services/access-control-module-service.js'
import { config as alertLowStock } from '../src/subscribers/alert-low-stock.js'
import { SOURCE_LOCALE } from '../src/workflows/admin/utils/admin-locales.js'
import { importProductWorkflow } from '../src/workflows/product/import-product.js'
import { MARKETS, seedMarkets } from './seed/markets.js'
import { SEED_IMAGE_DIR, seedImageFile } from './seed/seed-images.js'

// The catalogue is imported through workflows, and `import-product` runs `create-product` inside a
// step. The simple engine runs both here, in-process, as the workflow Worker does — so seeding needs
// no Temporal server. The bus stays Temporal, as on the API's root: nothing below publishes.
const { container } = await createWorkerContainer({ engine: 'simple', eventBus: 'temporal' })

const authService = container.resolve<IAuthModuleService>(Modules.AUTH)
const customerService = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)
const userService = container.resolve<IUserModuleService>(Modules.USER)
const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
const fileService = container.resolve<IFileModuleService>(Modules.FILE)
const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)
const cartService = container.resolve<ICartModuleService>(Modules.CART)
const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)
const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION)
const fulfillmentService = container.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
const regionService = container.resolve<IRegionModuleService>(Modules.REGION)
const stockLocationService = container.resolve<IStockLocationModuleService>(Modules.STOCK_LOCATION)
const storeService = container.resolve<IStoreModuleService>(Modules.STORE)
const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
const accessControlService = container.resolve<AccessControlModuleService>(Modules.ACCESS_CONTROL)

// --- Seed images ---
// The catalogue's photos are committed in `seed-images/` (see its README), each named after the CDN
// URL the CSV gives for it, so the import below attaches stored copies and never reaches the network.
const STATIC_SEED_DIR = path.join(process.cwd(), 'static', 'seed')
// Mirrors the default in `src/providers/file-localfs/local-file-provider.ts`.
const STATIC_BASE_URL = 'http://localhost:3000/static'

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

const SEED_IMAGES = (await fs.readdir(SEED_IMAGE_DIR)).filter(
  (file) => MIME_TYPE_BY_EXTENSION[path.extname(file).toLowerCase()],
)

/**
 * Copies the photos into the gitignored `static/` root so they serve through the same `/static`
 * route as uploads. Keys stay stable, so re-seeding repairs a `static/` that was cleared or
 * half-populated.
 */
async function copySeedImages(): Promise<Map<string, string>> {
  await fs.mkdir(STATIC_SEED_DIR, { recursive: true })

  await Promise.all(
    SEED_IMAGES.map((file) => fs.copyFile(path.join(SEED_IMAGE_DIR, file), path.join(STATIC_SEED_DIR, file))),
  )

  console.info(`Copied ${SEED_IMAGES.length} seed images to ${STATIC_SEED_DIR}`)
  return new Map(SEED_IMAGES.map((file) => [file, `${STATIC_BASE_URL}/seed/${file}`]))
}

/** Pushes the photos through the file module, so they land wherever uploads land. */
async function uploadSeedImages(): Promise<Map<string, string>> {
  const files = SEED_IMAGES

  const uploaded = await fileService.createFiles(
    await Promise.all(
      files.map(async (file) => {
        const mimeType = MIME_TYPE_BY_EXTENSION[path.extname(file).toLowerCase()]
        if (!mimeType) throw new Error(`Unsupported seed image type: "${file}"`)

        return {
          filename: `seed/${file}`,
          mimeType,
          content: (await fs.readFile(path.join(SEED_IMAGE_DIR, file))).toString('base64'),
          access: 'public' as const,
        }
      }),
    ),
  )

  console.info(
    `Uploaded ${uploaded.length} seed images via the "${fileService.getProvider().getIdentifier()}" provider`,
  )
  return new Map(
    files.map((file, index) => {
      const result = uploaded[index]
      if (!result) throw new Error(`Upload returned no result for seed image "${file}"`)
      return [file, result.url]
    }),
  )
}

// A remote deployment has no local disk the storefront can reach, so its photos have to go to the
// configured object storage. Locally they stay on disk under a stable path.
const seedImageUrls =
  fileService.getProvider().getIdentifier() === 'localfs' ? await copySeedImages() : await uploadSeedImages()

/** Where the photo a CSV image URL names was stored. */
const hostedImageUrl = (csvUrl: string) => {
  const url = seedImageUrls.get(seedImageFile(csvUrl))
  if (!url) throw new Error(`No seed image for "${csvUrl}". Rerun scripts/seed/build-product-import-csv.ts`)
  return url
}

// --- Users ---
const existingUsers = await userService.listUsers()
if (existingUsers.length === 0) {
  const users = Array.from({ length: 10 }, (_, i) => ({
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    locale: SOURCE_LOCALE,
  }))
  const createdUsers = await userService.createUsers(users)
  console.info(`Seeded ${createdUsers.length} users`)
} else {
  console.info(`Skipped users (${existingUsers.length} already exist)`)
}

// --- Dev admin user (registered + linked, ready for admin auth) ---
const DEV_ADMIN_ID = 'usr_91b8c8f5875146199cba4ea388f31163'
const DEV_ADMIN_EMAIL = 'admin@example.com'
const DEV_ADMIN_PASSWORD = '123'

const existingAdminIdentities = await authService.listProviderIdentities({
  entityId: DEV_ADMIN_EMAIL,
  provider: 'emailpass',
})
if (existingAdminIdentities.length === 0) {
  const registrationResult = await authService.register('emailpass', {
    body: { email: DEV_ADMIN_EMAIL, password: DEV_ADMIN_PASSWORD },
  })
  if (!registrationResult.success || !registrationResult.authIdentity) {
    throw new Error(`Failed to register dev admin: ${registrationResult.error}`)
  }
  console.info(`Seeded dev admin: ${DEV_ADMIN_EMAIL} / ${DEV_ADMIN_PASSWORD}`)
} else {
  console.info(`Skipped dev admin (${DEV_ADMIN_EMAIL} already exists)`)
}

// Ensure admin user entity exists and is linked to auth identity
const adminIdentity = (
  await authService.listProviderIdentities({
    entityId: DEV_ADMIN_EMAIL,
    provider: 'emailpass',
  })
)[0]
if (adminIdentity) {
  const adminAuthIdentity = await authService.retrieveAuthIdentity(adminIdentity.authIdentityId)
  const hasUserId =
    adminAuthIdentity.appMetadata &&
    typeof adminAuthIdentity.appMetadata === 'object' &&
    'userId' in adminAuthIdentity.appMetadata

  if (!hasUserId) {
    const existingAdminUsers = await userService.listUsers({ email: DEV_ADMIN_EMAIL })
    let userId: string
    if (existingAdminUsers.length > 0 && existingAdminUsers[0]) {
      userId = existingAdminUsers[0].id
    } else {
      const [created] = await userService.createUsers([
        { id: DEV_ADMIN_ID, name: 'Dev Admin', email: DEV_ADMIN_EMAIL, locale: SOURCE_LOCALE },
      ])
      if (!created) throw new Error('Failed to create dev admin user entity')
      userId = created.id
    }
    await authService.updateAuthIdentities([adminIdentity.authIdentityId], {
      appMetadata: { ...((adminAuthIdentity.appMetadata as Record<string, unknown>) ?? {}), userId },
    })
    console.info(`Linked dev admin user ${userId} to auth identity`)
  } else {
    console.info('Skipped admin user linking (already linked)')
  }
}

// --- RBAC: super admin role + catalogue editor role + assignment ---
const existingRoles = await accessControlService.listRoles()
if (existingRoles.length === 0) {
  const superAdminRole = await accessControlService.createRole({
    name: 'Super Admin',
    features: [],
  })

  // createRole validates features (rejects '*' for non-super-admin roles) and updateRole
  // blocks super-admin modifications, so we set all privileged fields via the repository.
  type UpdatableRepo = { update(id: string, data: Record<string, unknown>): Promise<unknown> }
  // biome-ignore lint/suspicious/noExplicitAny: seed-only cast to reach private repository
  const roleRepo = (accessControlService as any).roleRepository as UpdatableRepo
  await roleRepo.update(superAdminRole.id, { isSuperAdmin: true, protected: true, featuresJson: ['*'] })

  const adminUsers = await userService.listUsers({ email: DEV_ADMIN_EMAIL })
  const adminUser = adminUsers[0]
  if (adminUser) {
    await accessControlService.assignRolesToUser(adminUser.id, [superAdminRole.id])
    console.info(`Assigned super admin role to ${DEV_ADMIN_EMAIL}`)
  }

  await accessControlService.createRole({
    name: 'Catalogue Editor',
    features: ['product.*'],
  })

  console.info('Seeded super admin + catalogue editor roles')
} else {
  console.info(`Skipped RBAC roles (${existingRoles.length} already exist)`)
}

// --- Dev customer (registered + email-verified, ready for store auth) ---
const DEV_CUSTOMER_ID = 'cus_6021b88819c64605807aebf26260d7b7'
const DEV_CUSTOMER_EMAIL = 'delivered@resend.dev'
const DEV_CUSTOMER_PASSWORD = '123'

const existingCustomerIdentities = await authService.listProviderIdentities({
  entityId: DEV_CUSTOMER_EMAIL,
  provider: 'emailpass',
})
if (existingCustomerIdentities.length === 0) {
  const registrationResult = await authService.register('emailpass', {
    body: { email: DEV_CUSTOMER_EMAIL, password: DEV_CUSTOMER_PASSWORD },
  })
  if (!registrationResult.success || !registrationResult.authIdentity) {
    throw new Error(`Failed to register dev customer: ${registrationResult.error}`)
  }
  console.info(`Seeded dev customer: ${DEV_CUSTOMER_EMAIL} / ${DEV_CUSTOMER_PASSWORD}`)
} else {
  console.info(`Skipped dev customer (${DEV_CUSTOMER_EMAIL} already exists)`)
}

// Ensure customer entity exists and is linked to auth identity
const customerIdentity = (
  await authService.listProviderIdentities({
    entityId: DEV_CUSTOMER_EMAIL,
    provider: 'emailpass',
  })
)[0]
if (customerIdentity) {
  const authIdentity = await authService.retrieveAuthIdentity(customerIdentity.authIdentityId)
  const hasCustomerId =
    authIdentity.appMetadata && typeof authIdentity.appMetadata === 'object' && 'customerId' in authIdentity.appMetadata

  if (!hasCustomerId) {
    const existingCustomers = await customerService.listCustomers({ email: DEV_CUSTOMER_EMAIL })
    let customerId: string
    if (existingCustomers.length > 0 && existingCustomers[0]) {
      customerId = existingCustomers[0].id
    } else {
      const [created] = await customerService.createCustomers([
        { id: DEV_CUSTOMER_ID, firstName: 'Dev', lastName: 'Customer', email: DEV_CUSTOMER_EMAIL, hasAccount: true },
      ])
      if (!created) throw new Error('Failed to create dev customer entity')
      customerId = created.id
    }
    await authService.updateAuthIdentities([customerIdentity.authIdentityId], {
      appMetadata: { ...((authIdentity.appMetadata as Record<string, unknown>) ?? {}), customerId },
    })
    console.info(`Linked dev customer entity ${customerId} to auth identity`)
  } else {
    console.info('Skipped customer entity linking (already linked)')
  }

  // Ensure email verification exists (idempotent — safe to re-run after earlier seeds that lacked it)
  const existingVerifications = await authService.listAuthVerifications({
    authIdentityId: customerIdentity.authIdentityId,
    entityId: DEV_CUSTOMER_EMAIL,
    entityType: 'email',
  })
  const existingVerification = existingVerifications[0]
  if (existingVerifications.length === 0) {
    await authService.createAuthVerifications([
      {
        authIdentityId: customerIdentity.authIdentityId,
        entityId: DEV_CUSTOMER_EMAIL,
        entityType: 'email',
        codeProvider: 'token',
        requestedAt: new Date(),
      },
    ])
    const verifications = await authService.listAuthVerifications({
      authIdentityId: customerIdentity.authIdentityId,
      entityId: DEV_CUSTOMER_EMAIL,
      entityType: 'email',
    })
    const verification = verifications[0]
    if (verification) {
      await authService.updateAuthVerifications([verification.id], { verifiedAt: new Date() })
    }
    console.info('Created email verification for dev customer')
  } else if (existingVerification && !existingVerification.verifiedAt) {
    await authService.updateAuthVerifications([existingVerification.id], { verifiedAt: new Date() })
    console.info('Marked existing email verification as verified for dev customer')
  } else {
    console.info('Skipped email verification (already verified)')
  }
}

// --- Markets: regions, the ISO country table, and the store that trades in them ---
// Shared with the end-to-end seed, which needs the same markets and nothing else. See
// scripts/seed/markets.ts.
await seedMarkets({ regionService, storeService, paymentService, linkService })

// --- Stock location ---
// The shop holds exactly one, and every Inventory Level below names it. It is seeded rather than
// created on demand for the same reason the store, the regions and the default shipping profile
// are: nothing in the admin creates one.
const [existingStockLocation] = await stockLocationService.listStockLocations()
const stockLocation =
  existingStockLocation ?? (await stockLocationService.createStockLocation({ name: 'Main Warehouse' }))
console.info(
  existingStockLocation
    ? `Skipped stock location (${existingStockLocation.name} already exists)`
    : `Seeded stock location "${stockLocation.name}"`,
)

// --- Catalogue ---
// Two committed files define it, the way they define a real store: `catalog-structure.yaml` holds
// the Categories and Collections with their tag rules plus the menu, and `product-import.csv` the
// products. Both go through what the admin runs — the structure apply, then the CSV's parse and one
// `import-product` workflow per product — so membership comes from the rules, as it would there.
const CATALOG_STRUCTURE_PATH = path.join(import.meta.dirname, 'seed', 'catalog-structure.yaml')
const CATALOG_CSV_PATH = path.join(import.meta.dirname, 'seed', 'product-import.csv')

// The CSV build script stocks this variant low (`STOCK_BY_SKU` there) — at or below the threshold
// `seedMarkets` writes onto the store — so the shopper's "only N left" line and the shopkeeper's
// alert are both reachable on a fresh database.
const LOW_STOCK_SKU = 'MENTSHIRT-MEDIUM-OCEAN'

const existingProducts = await productService.listProducts()
if (existingProducts.length > 0) {
  console.info(`Skipped catalogue (${existingProducts.length} products already exist)`)
} else {
  const structurePlan = await productService.planCatalogStructure(createReadStream(CATALOG_STRUCTURE_PATH))
  if (!structurePlan.structure) {
    const errors = structurePlan.errors.map((error) => `${error.path}: ${error.message}`).join('\n')
    throw new Error(`catalog-structure.yaml has errors:\n${errors}`)
  }
  const store = await storeService.resolveStore()
  if (!store) throw new Error('Expected seedMarkets to have created the store')
  await storeService.updateStores([store.id], { navigation: structurePlan.structure.menu })
  const { categories, collections } = await productService.applyCatalogStructure(structurePlan.structure)
  console.info(
    `Applied catalog-structure.yaml: ${categories.create.length} categories, ${collections.create.length} collections`,
  )

  // Read against the store's currencies, as the admin's preview reads an uploaded file.
  const [defaultCurrency] = await storeService.listStoreCurrencies({ storeId: store.id, isDefault: true })
  const regions = await regionService.listRegions()
  const importPlan = await productService.planProductImport(createReadStream(CATALOG_CSV_PATH), {
    overwrite: false,
    publish: true,
    defaultCurrency: defaultCurrency?.currencyCode ?? null,
    marketCurrencies: Object.fromEntries(
      regions.map((region) => [region.name.trim().toLowerCase(), region.currencyCode]),
    ),
  })
  if (importPlan.errors.length > 0) {
    const errors = importPlan.errors.map((error) => `line ${error.line}: ${error.message}`).join('\n')
    throw new Error(`product-import.csv has errors:\n${errors}`)
  }

  // One at a time, as the admin's run goes: a product creates the tags, types and option values the
  // next one may share.
  const products = importPlan.chunks.flat()
  for (const product of products) {
    await importProductWorkflow.run({
      product: {
        ...product,
        imageUrls: product.imageUrls.map(hostedImageUrl),
        variants: product.variants.map((variant) => ({
          ...variant,
          imageUrl: variant.imageUrl ? hostedImageUrl(variant.imageUrl) : null,
        })),
      },
      overwrite: false,
      hostedImages: true,
    })
  }
  console.info(`Imported ${products.length} products from product-import.csv`)

  // A CSV has no column for how an option is drawn. Each colourway has its own photos, so the
  // storefront draws Color as image swatches.
  const [colorOption] = await productService.listProductOptions({ title: 'Color' })
  if (colorOption) await productService.updateProductOption(colorOption.id, { renderAs: 'swatch' })

  // --- The low-stock alert, produced rather than written ---
  // The notification is the subscriber's, not the seed's: it does the threshold comparison, writes
  // the body and links to the variant, so a dev database shows the real thing rather than a fixture
  // that can drift from it.
  //
  // Delivered to the handler directly rather than through `bus.emit`, because this script's bus is
  // Temporal-backed — an emitted event would sit on `proteus-events` until someone ran
  // `worker:events`, and seeding has to be self-contained. Through `defineSubscriber` for the reason
  // the generated registry calls it: that erased handler is what an adapter invokes.
  const [lowStockItem] = await inventoryService.listInventoryItems({ sku: LOW_STOCK_SKU })
  const [lowStockLevel] = lowStockItem
    ? await inventoryService.listInventoryLevels({ inventoryItemId: lowStockItem.id, locationId: stockLocation.id })
    : []
  if (!lowStockLevel) throw new Error(`Expected product-import.csv to stock ${LOW_STOCK_SKU}`)

  await defineSubscriber(alertLowStock).handler({
    event: buildEvent(
      'inventory.available_decreased',
      {
        id: lowStockLevel.id,
        version: lowStockLevel.version,
        stockedQuantity: lowStockLevel.stockedQuantity,
        reservedQuantity: lowStockLevel.reservedQuantity,
      },
      alertLowStock.name,
    ),
    container,
  })
  console.info(`Delivered the low-stock event for ${LOW_STOCK_SKU} — "${alertLowStock.name}" wrote the alert`)

  // --- Cart with line items (for testing payment endpoints) ---
  const existingCarts = await cartService.listCarts()
  if (existingCarts.length === 0) {
    const CART_LINES = [
      { sku: 'MENTSHIRT-MEDIUM-GREEN', quantity: 2 },
      { sku: 'HOODIEOLD-LARGE-OLIVE', quantity: 1 },
    ]
    const variants = await productService.listProductVariants({ sku: CART_LINES.map((line) => line.sku) })
    const cartProducts = await productService.listProducts({ id: variants.map((variant) => variant.productId) })
    const importedVariants = products.flatMap((product) => product.variants)

    const items = CART_LINES.map(({ sku, quantity }) => {
      const variant = variants.find((candidate) => candidate.sku === sku)
      const product = cartProducts.find((candidate) => candidate.id === variant?.productId)
      const price = importedVariants
        .find((candidate) => candidate.sku === sku)
        ?.prices.find((candidate) => candidate.currencyCode === 'usd')
      if (!variant || !product || !price) {
        throw new Error(`Expected product-import.csv to contain the cart line item variant ${sku}`)
      }
      return {
        title: `${product.title} (${variant.title})`,
        quantity,
        unitPrice: new BigNumber(price.amount),
        variantId: variant.id,
        variantSku: variant.sku,
        productId: product.id,
        productTitle: product.title,
      }
    })

    const [cart] = await cartService.createCarts([{ currencyCode: 'usd', email: 'test@example.com', items }])
    const total = items.reduce((sum, item) => sum.plus(item.unitPrice.times(item.quantity)), new BigNumber(0))
    console.info(`Seeded cart ${cart?.id} with ${items.length} line items (total: $${total.toFixed(2)})`)
  } else {
    console.info(`Skipped cart (${existingCarts.length} already exist)`)
  }
}

// --- Shipping options ---
const existingShippingOptions = await fulfillmentService.listShippingOptions()
if (existingShippingOptions.length === 0) {
  const shippingProfile = await fulfillmentService.createShippingProfile({ name: 'Default', type: 'default' })

  const fulfillmentSet = await fulfillmentService.createFulfillmentSet({ name: 'Default Shipping', type: 'shipping' })

  const serviceZone = await fulfillmentService.createServiceZone({
    name: 'Markets',
    fulfillmentSetId: fulfillmentSet.id,
    // The zone covers exactly the sellable countries. A zone reaching further would offer
    // shipping to a country no region prices, and checkout would have nothing to charge in.
    geoZones: MARKETS.flatMap((market) =>
      market.countries.map((country) => ({ type: 'country' as const, countryCode: country.iso2 })),
    ),
  })

  const standardType = await fulfillmentService.createShippingOptionType({
    label: 'Standard',
    description: 'Ship in 2-3 days.',
    code: 'standard',
  })
  const expressType = await fulfillmentService.createShippingOptionType({
    label: 'Express',
    description: 'Ship in 24 hours.',
    code: 'express',
  })

  await fulfillmentService.createShippingOptions([
    {
      name: 'Standard Shipping',
      priceType: 'flat',
      amount: 500,
      serviceZoneId: serviceZone.id,
      shippingProfileId: shippingProfile.id,
      shippingOptionTypeId: standardType.id,
      providerId: 'manual_manual',
    },
    {
      name: 'Express Shipping',
      priceType: 'flat',
      amount: 1500,
      serviceZoneId: serviceZone.id,
      shippingProfileId: shippingProfile.id,
      shippingOptionTypeId: expressType.id,
      providerId: 'manual_manual',
    },
  ])
  console.info('Seeded shipping profile, fulfillment set, service zone, geo zones, and 2 shipping options')
} else {
  console.info(`Skipped shipping options (${existingShippingOptions.length} already exist)`)
}

// --- Refund reasons ---
const existingReasons = await paymentService.listRefundReasons()
if (existingReasons.length === 0) {
  await paymentService.createRefundReasons([
    { label: 'Too Large', code: 'too_large' },
    { label: 'Too Small', code: 'too_small' },
    { label: 'Damaged', code: 'damaged' },
    { label: 'Changed Mind', code: 'changed_mind' },
  ])
  console.info('Seeded 4 refund reasons')
} else {
  console.info(`Skipped refund reasons (${existingReasons.length} already exist)`)
}

// --- Notifications (feed channel, addressed to dev admin) ---
// Pass --notifications flag to seed: pnpm --filter backend run db:seed:dev --notifications
const seedNotifications = process.argv.includes('--notifications')
if (seedNotifications && (await notificationService.listNotifications({ channel: 'feed' })).length === 0) {
  const now = Date.now()

  await notificationService.createNotifications([
    {
      to: DEV_ADMIN_ID,
      channel: 'feed',
      template: 'product-import',
      triggerType: 'product.import.completed',
      resourceType: 'product',
      receiverId: DEV_ADMIN_ID,
      data: {
        title: 'Product import completed',
        description: '42 products were imported successfully.',
        file: 'https://example.com/imports/products-2026-08-08.csv',
      },
      idempotencyKey: `seed-notif-1-${now}`,
    },
    {
      to: DEV_ADMIN_ID,
      channel: 'feed',
      template: 'order-placed',
      triggerType: 'order.placed',
      resourceType: 'order',
      resourceId: 'order_abc123',
      receiverId: DEV_ADMIN_ID,
      data: {
        title: 'New order received',
        description: 'Order #1042 for $170.00 from customer@example.com.',
      },
      idempotencyKey: `seed-notif-2-${now}`,
    },
    {
      to: DEV_ADMIN_ID,
      channel: 'feed',
      template: 'payment-captured',
      triggerType: 'payment.captured',
      resourceType: 'payment',
      resourceId: 'pay_xyz789',
      receiverId: DEV_ADMIN_ID,
      data: {
        title: 'Payment captured',
        description: 'Payment of $170.00 captured for order #1042.',
      },
      idempotencyKey: `seed-notif-4-${now}`,
    },
    {
      to: DEV_ADMIN_ID,
      channel: 'feed',
      template: 'fulfillment-shipped',
      triggerType: 'fulfillment.shipped',
      resourceType: 'fulfillment',
      receiverId: DEV_ADMIN_ID,
      data: {
        title: 'Shipment dispatched',
        description: 'Order #1038 has been shipped via FedEx. Tracking: 7948302817.',
      },
      idempotencyKey: `seed-notif-5-${now}`,
    },
    {
      to: DEV_ADMIN_EMAIL,
      channel: 'feed',
      template: 'export-ready',
      triggerType: 'export.completed',
      receiverId: DEV_ADMIN_ID,
      data: {
        title: 'Export ready for download',
        description: 'Your customer export (1,247 records) is ready.',
        file: 'https://example.com/exports/customers-2026-08-07.csv',
      },
      idempotencyKey: `seed-notif-6-${now}`,
    },
    {
      to: DEV_ADMIN_ID,
      channel: 'feed',
      template: 'refund-requested',
      triggerType: 'order.refund_requested',
      resourceType: 'order',
      resourceId: 'order_def456',
      receiverId: DEV_ADMIN_ID,
      data: {
        title: 'Refund requested',
        description: 'Customer requested a $45.00 refund for order #1035. Reason: damaged.',
      },
      idempotencyKey: `seed-notif-7-${now}`,
    },
    {
      to: DEV_ADMIN_ID,
      channel: 'feed',
      template: 'system',
      triggerType: 'system.update',
      receiverId: DEV_ADMIN_ID,
      data: {
        title: 'System update scheduled',
        description: 'A maintenance window is scheduled for Aug 10, 2:00 AM - 4:00 AM UTC.',
      },
      idempotencyKey: `seed-notif-8-${now}`,
    },
  ])
  console.info('Seeded 8 feed notifications for dev admin')
} else if (seedNotifications) {
  console.info('Skipped notifications (already exist)')
}

console.info('Done!')
process.exit(0)
