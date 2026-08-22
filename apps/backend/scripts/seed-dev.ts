import fs from 'node:fs/promises'
import path from 'node:path'
import { BigNumber } from '../src/core/db/bignum.js'
import type {
  IAuthModuleService,
  ICartModuleService,
  ICustomerModuleService,
  IFulfillmentModuleService,
  IInventoryModuleService,
  ILinkService,
  INotificationModuleService,
  IPaymentModuleService,
  IPricingModuleService,
  IProductModuleService,
  IUserModuleService,
} from '../src/core/types/index.js'
import { ContainerRegistrationKeys, Modules } from '../src/core/utils/index.js'
import { container } from '../src/framework/runtime/container.node.js'

const authService = container.resolve<IAuthModuleService>(Modules.AUTH)
const customerService = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)
const userService = container.resolve<IUserModuleService>(Modules.USER)
const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)
const cartService = container.resolve<ICartModuleService>(Modules.CART)
const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)
const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION)
const pricingService = container.resolve<IPricingModuleService>(Modules.PRICING)
const fulfillmentService = container.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

// --- Seed images ---
// Product photos live in `seed-images/` (committed, see its README for provenance) and are copied
// into the gitignored `static/` root so they serve through the same `/static` route as uploads.
const SEED_IMAGE_SOURCE_DIR = path.join(process.cwd(), 'seed-images')
const SEED_IMAGE_DIR = path.join(process.cwd(), 'static', 'seed')
// Mirrors the default in `src/providers/file-localfs/local-file-provider.ts`.
const STATIC_BASE_URL = 'http://localhost:3000/static'

const SEED_IMAGES = {
  tshirtBlackFront: 'tshirt-black-front.jpg',
  tshirtBlackBack: 'tshirt-black-back.jpg',
  tshirtWhiteFront: 'tshirt-white-front.jpg',
  tshirtWhiteFlat: 'tshirt-white-flat.jpg',
  sweatshirtWhite: 'sweatshirt-white.jpg',
  sweatshirtBlack: 'sweatshirt-black.jpg',
  sweatpantsGrey: 'sweatpants-grey.jpg',
  sweatpantsStreet: 'sweatpants-street.jpg',
  shortsDenim: 'shorts-denim.jpg',
} as const

const imageUrl = (file: string) => `${STATIC_BASE_URL}/seed/${file}`

async function copySeedImages() {
  await fs.mkdir(SEED_IMAGE_DIR, { recursive: true })

  // Overwrites unconditionally — the copies are disposable, and re-seeding should repair a
  // `static/` directory that was cleared or half-populated.
  await Promise.all(
    Object.values(SEED_IMAGES).map((file) =>
      fs.copyFile(path.join(SEED_IMAGE_SOURCE_DIR, file), path.join(SEED_IMAGE_DIR, file)),
    ),
  )

  console.info(`Copied ${Object.keys(SEED_IMAGES).length} seed images to ${SEED_IMAGE_DIR}`)
}

await copySeedImages()

// --- Users ---
const existingUsers = await userService.listUsers()
if (existingUsers.length === 0) {
  const users = Array.from({ length: 10 }, (_, i) => ({
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
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
      const [created] = await userService.createUsers([{ id: DEV_ADMIN_ID, name: 'Dev Admin', email: DEV_ADMIN_EMAIL }])
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

// --- Dev customer (registered + email-verified, ready for store auth) ---
const DEV_CUSTOMER_ID = 'cus_6021b88819c64605807aebf26260d7b7'
const DEV_CUSTOMER_EMAIL = 'customer@example.com'
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
        { id: DEV_CUSTOMER_ID, firstName: 'Dev', lastName: 'Customer', email: DEV_CUSTOMER_EMAIL },
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

// --- Products ---
const existingProducts = await productService.listProducts()
if (existingProducts.length > 0) {
  console.info(`Skipped products (${existingProducts.length} already exist)`)
} else {
  // One catalogue drives products, option values, variants, prices and images, so a colourway is
  // described once and everything downstream derives from it.
  const SIZES = ['S', 'M', 'L', 'XL']

  type CatalogEntry = {
    title: string
    handle: string
    description: string
    skuPrefix: string
    price: number
    /** Colourway to its photos in gallery order. The first photo becomes that colourway's thumbnail. */
    colors: Record<string, string[]>
  }

  const CATALOG: CatalogEntry[] = [
    {
      title: 'Classic T-Shirt',
      handle: 't-shirt',
      description:
        'Reimagine the feeling of a classic T-shirt. With our cotton T-shirts, everyday essentials no longer have to be ordinary.',
      skuPrefix: 'SHIRT',
      price: 2500,
      colors: {
        Black: [SEED_IMAGES.tshirtBlackFront, SEED_IMAGES.tshirtBlackBack],
        White: [SEED_IMAGES.tshirtWhiteFront, SEED_IMAGES.tshirtWhiteFlat],
      },
    },
    {
      title: 'Vintage Sweatshirt',
      handle: 'sweatshirt',
      description:
        'Reimagine the feeling of a classic sweatshirt. With our cotton sweatshirt, everyday essentials no longer have to be ordinary.',
      skuPrefix: 'SWEATSHIRT',
      price: 4500,
      colors: {
        White: [SEED_IMAGES.sweatshirtWhite],
        Black: [SEED_IMAGES.sweatshirtBlack],
      },
    },
    {
      title: 'Classic Sweatpants',
      handle: 'sweatpants',
      description:
        'Reimagine the feeling of classic sweatpants. With our cotton sweatpants, everyday essentials no longer have to be ordinary.',
      skuPrefix: 'SWEATPANTS',
      price: 3500,
      colors: {
        Grey: [SEED_IMAGES.sweatpantsGrey, SEED_IMAGES.sweatpantsStreet],
      },
    },
    {
      title: 'Vintage Shorts',
      handle: 'shorts',
      description:
        'Reimagine the feeling of classic shorts. With our cotton shorts, everyday essentials no longer have to be ordinary.',
      skuPrefix: 'SHORTS',
      price: 3000,
      colors: {
        Blue: [SEED_IMAGES.shortsDenim],
      },
    },
  ]

  const galleryOf = (entry: CatalogEntry) => Object.values(entry.colors).flat()

  const createdProducts = await productService.createProducts(
    CATALOG.map((entry) => {
      const [thumbnail] = galleryOf(entry)
      if (!thumbnail) throw new Error(`Catalog entry "${entry.handle}" has no images`)
      return {
        title: entry.title,
        handle: entry.handle,
        description: entry.description,
        status: 'published' as const,
        weight: 400,
        thumbnail: imageUrl(thumbnail),
      }
    }),
  )
  const productByHandle = new Map(createdProducts.map((product) => [product.handle, product]))
  const productFor = (entry: CatalogEntry) => {
    const product = productByHandle.get(entry.handle)
    if (!product) throw new Error(`Missing product for catalog entry "${entry.handle}"`)
    return product
  }
  console.info(`Seeded ${createdProducts.length} products`)

  // --- Options (global) ---
  const colorValues = [...new Set(CATALOG.flatMap((entry) => Object.keys(entry.colors)))]

  const sizeOption = await productService.createProductOption({
    title: 'Size',
    values: SIZES.map((value, rank) => ({ value, rank })),
  })
  const colorOption = await productService.createProductOption({
    title: 'Color',
    values: colorValues.map((value, rank) => ({ value, rank })),
  })
  console.info('Seeded global product options')

  // --- Link options to products ---
  // Each product exposes every size, but only the colourways it actually has photos for.
  const sizeValueIds = sizeOption.values.map((value) => value.id)
  const colorValueIdByName = new Map(colorOption.values.map((value) => [value.value, value.id]))

  await Promise.all(
    CATALOG.map((entry) =>
      productService.setProductOptions(productFor(entry).id, {
        options: [
          { optionId: sizeOption.id, valueIds: sizeValueIds },
          {
            optionId: colorOption.id,
            valueIds: Object.keys(entry.colors).flatMap((color) => {
              const valueId = colorValueIdByName.get(color)
              return valueId ? [valueId] : []
            }),
          },
        ],
      }),
    ),
  )
  console.info('Linked options to products')

  // --- Variants ---
  // Every product is now size x colour, so each variant maps onto exactly one colourway gallery.
  const variantSpecs = CATALOG.flatMap((entry) =>
    Object.keys(entry.colors).flatMap((color) =>
      SIZES.map((size) => ({
        productId: productFor(entry).id,
        title: `${size} / ${color}`,
        sku: `${entry.skuPrefix}-${size}-${color.toUpperCase()}`,
        color,
        price: entry.price,
      })),
    ),
  )

  const createdVariants = await productService.createProductVariants(
    variantSpecs.map(({ productId, title, sku }) => ({ productId, title, sku })),
  )
  console.info(`Seeded ${createdVariants.length} product variants`)

  // --- Prices ---
  const priceSets = await pricingService.createPriceSets(
    variantSpecs.map((spec) => ({ prices: [{ currencyCode: 'usd', amount: new BigNumber(spec.price) }] })),
  )

  await Promise.all(
    createdVariants.map((variant, i) => {
      const priceSet = priceSets[i]
      if (!priceSet) throw new Error(`Missing price set for variant "${variant.id}"`)
      return linkService.repo('productVariantPriceSet').create({ variantId: variant.id, priceSetId: priceSet.id })
    }),
  )
  console.info(`Seeded ${priceSets.length} price sets with variant links`)

  // --- Images ---
  const createdImages = await productService.createProductImages(
    CATALOG.flatMap((entry) =>
      galleryOf(entry).map((file, rank) => ({ productId: productFor(entry).id, url: imageUrl(file), rank })),
    ),
  )
  console.info(`Seeded ${createdImages.length} product images`)

  // --- Variant images ---
  // A variant shows the photos of its own colourway, which is the case variant images exist for.
  const imageIdByUrl = new Map(createdImages.map((image) => [image.url, image.id]))
  const galleryKey = (productId: string, color: string) => `${productId}:${color}`
  const galleryByColorway = new Map(
    CATALOG.flatMap((entry) =>
      Object.entries(entry.colors).map(([color, files]) => [galleryKey(productFor(entry).id, color), files] as const),
    ),
  )

  const variantImageLinks = createdVariants.flatMap((variant, i) => {
    const spec = variantSpecs[i]
    const files = spec ? (galleryByColorway.get(galleryKey(spec.productId, spec.color)) ?? []) : []
    return files.flatMap((file) => {
      const imageId = imageIdByUrl.get(imageUrl(file))
      return imageId ? [{ imageId, variantId: variant.id }] : []
    })
  })

  await productService.addImageToVariant(variantImageLinks)

  // Grouped by thumbnail so each colourway is one update rather than one per size.
  const variantIdsByThumbnail = new Map<string, string[]>()
  for (const [i, variant] of createdVariants.entries()) {
    const spec = variantSpecs[i]
    const [front] = spec ? (galleryByColorway.get(galleryKey(spec.productId, spec.color)) ?? []) : []
    if (!front) continue
    const url = imageUrl(front)
    variantIdsByThumbnail.set(url, [...(variantIdsByThumbnail.get(url) ?? []), variant.id])
  }

  await Promise.all(
    [...variantIdsByThumbnail].map(([thumbnail, variantIds]) =>
      productService.updateProductVariants(variantIds, { thumbnail }),
    ),
  )
  console.info(`Seeded ${variantImageLinks.length} variant image links with colour-matched thumbnails`)

  // --- Inventory Items + Levels + Variant Links ---
  const inventoryData = createdVariants.map((v) => ({
    sku: v.sku,
    title: v.title,
    requiresShipping: true,
  }))

  const createdItems = await inventoryService.createInventoryItems(inventoryData)
  console.info(`Seeded ${createdItems.length} inventory items`)

  // Create inventory levels (all items at a single default location with stock)
  await inventoryService.createInventoryLevels(
    createdItems.map((item) => ({
      inventoryItemId: item.id,
      locationId: 'loc_default',
      stockedQuantity: 100,
      reservedQuantity: 0,
      incomingQuantity: 0,
    })),
  )
  console.info(`Seeded ${createdItems.length} inventory levels`)

  // Link variants -> inventory items (1:1 by matching SKU order)
  const links = createdVariants.map((variant, i) => {
    const item = createdItems[i]
    if (!item) throw new Error(`Missing inventory item for variant "${variant.id}"`)
    return { variantId: variant.id, inventoryItemId: item.id }
  })
  await linkService.repo('productVariantInventoryItem').createMany(links)
  console.info(`Seeded ${links.length} variant-inventory links`)

  // --- Cart with line items (for testing payment endpoints) ---
  const existingCarts = await cartService.listCarts()
  if (existingCarts.length === 0) {
    const tshirt = productByHandle.get('t-shirt')
    const sweatshirt = productByHandle.get('sweatshirt')
    const tshirtVariant = createdVariants.find((v) => v.sku === 'SHIRT-M-BLACK')
    const sweatshirtVariant = createdVariants.find((v) => v.sku === 'SWEATSHIRT-L-WHITE')
    if (!tshirt || !sweatshirt || !tshirtVariant || !sweatshirtVariant) {
      throw new Error('Expected the seeded catalog to contain the cart line item variants')
    }

    const [cart] = (await cartService.createCarts([
      {
        currencyCode: 'usd',
        email: 'test@example.com',
        items: [
          {
            title: 'Classic T-Shirt (M / Black)',
            quantity: 2,
            unitPrice: new BigNumber(2500),
            variantId: tshirtVariant.id,
            variantSku: tshirtVariant.sku,
            productId: tshirt.id,
            productTitle: 'Classic T-Shirt',
          },
          {
            title: 'Vintage Sweatshirt (L / White)',
            quantity: 1,
            unitPrice: new BigNumber(4500),
            variantId: sweatshirtVariant.id,
            variantSku: sweatshirtVariant.sku,
            productId: sweatshirt.id,
            productTitle: 'Vintage Sweatshirt',
          },
        ],
      },
    ])) as [Awaited<ReturnType<typeof cartService.createCarts>>[number]]

    console.info(`Seeded cart ${cart.id} with 2 line items (total: $95.00)`)
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
    name: 'Worldwide',
    fulfillmentSetId: fulfillmentSet.id,
    geoZones: [
      { type: 'country', countryCode: 'us' },
      { type: 'country', countryCode: 'ca' },
      { type: 'country', countryCode: 'gb' },
      { type: 'country', countryCode: 'de' },
      { type: 'country', countryCode: 'fr' },
      { type: 'country', countryCode: 'au' },
      { type: 'country', countryCode: 'se' },
      { type: 'country', countryCode: 'dk' },
    ],
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
// Pass --notifications flag to seed: npm run db:seed:dev -- --notifications
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
        description: 'Order #1042 for $95.00 from customer@example.com.',
      },
      idempotencyKey: `seed-notif-2-${now}`,
    },
    {
      to: DEV_ADMIN_EMAIL,
      channel: 'feed',
      template: 'low-stock',
      triggerType: 'inventory.low_stock',
      resourceType: 'inventory',
      receiverId: DEV_ADMIN_ID,
      data: {
        title: 'Low stock alert',
        description: 'Classic T-Shirt (M / Black) has only 3 units remaining.',
      },
      idempotencyKey: `seed-notif-3-${now}`,
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
        description: 'Payment of $95.00 captured for order #1042.',
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
