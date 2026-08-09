import { container } from '../src/container.node.js'
import type {
  IAuthModuleService,
  ICartModuleService,
  ICustomerModuleService,
  IInventoryModuleService,
  ILinkService,
  INotificationModuleService,
  IPaymentModuleService,
  IProductModuleService,
  IUserModuleService,
} from '../src/core/types/index.js'
import { ContainerRegistrationKeys, Modules } from '../src/core/utils/index.js'

const authService = container.resolve<IAuthModuleService>(Modules.AUTH)
const customerService = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)
const userService = container.resolve<IUserModuleService>(Modules.USER)
const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)
const cartService = container.resolve<ICartModuleService>(Modules.CART)
const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)
const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION)
const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

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
  const createdProducts = await productService.createProducts([
    {
      title: 'Classic T-Shirt',
      handle: 't-shirt',
      description:
        'Reimagine the feeling of a classic T-shirt. With our cotton T-shirts, everyday essentials no longer have to be ordinary.',
      status: 'published',
      weight: 400,
      thumbnail: 'https://placehold.co/600x400?text=T-Shirt',
    },
    {
      title: 'Vintage Sweatshirt',
      handle: 'sweatshirt',
      description:
        'Reimagine the feeling of a classic sweatshirt. With our cotton sweatshirt, everyday essentials no longer have to be ordinary.',
      status: 'published',
      weight: 400,
      thumbnail: 'https://placehold.co/600x400?text=Sweatshirt',
    },
    {
      title: 'Classic Sweatpants',
      handle: 'sweatpants',
      description:
        'Reimagine the feeling of classic sweatpants. With our cotton sweatpants, everyday essentials no longer have to be ordinary.',
      status: 'published',
      weight: 400,
      thumbnail: 'https://placehold.co/600x400?text=Sweatpants',
    },
    {
      title: 'Vintage Shorts',
      handle: 'shorts',
      description:
        'Reimagine the feeling of classic shorts. With our cotton shorts, everyday essentials no longer have to be ordinary.',
      status: 'published',
      weight: 400,
      thumbnail: 'https://placehold.co/600x400?text=Shorts',
    },
  ])
  const [tshirt, sweatshirt, sweatpants, shorts] = createdProducts as [
    (typeof createdProducts)[number],
    (typeof createdProducts)[number],
    (typeof createdProducts)[number],
    (typeof createdProducts)[number],
  ]
  console.info(`Seeded ${4} products`)

  // --- Options ---
  const tshirtOptions = await productService.createProductOptions([
    { productId: tshirt.id, title: 'Size' },
    { productId: tshirt.id, title: 'Color' },
  ])
  const [tshirtSize, tshirtColor] = tshirtOptions as [(typeof tshirtOptions)[number], (typeof tshirtOptions)[number]]
  const [sweatshirtSize] = (await productService.createProductOptions([
    { productId: sweatshirt.id, title: 'Size' },
  ])) as [(typeof tshirtOptions)[number]]
  const [sweatpantsSize] = (await productService.createProductOptions([
    { productId: sweatpants.id, title: 'Size' },
  ])) as [(typeof tshirtOptions)[number]]
  const [shortsSize] = (await productService.createProductOptions([{ productId: shorts.id, title: 'Size' }])) as [
    (typeof tshirtOptions)[number],
  ]
  console.info('Seeded product options')

  // --- Option Values ---
  const sizes = ['S', 'M', 'L', 'XL']
  const colors = ['Black', 'White']

  await productService.createProductOptionValues([
    ...sizes.map((value, i) => ({ optionId: tshirtSize.id, value, rank: i })),
    ...colors.map((value, i) => ({ optionId: tshirtColor.id, value, rank: i })),
    ...sizes.map((value, i) => ({ optionId: sweatshirtSize.id, value, rank: i })),
    ...sizes.map((value, i) => ({ optionId: sweatpantsSize.id, value, rank: i })),
    ...sizes.map((value, i) => ({ optionId: shortsSize.id, value, rank: i })),
  ])
  console.info('Seeded product option values')

  // --- Variants ---
  const tshirtVariants = sizes.flatMap((size) =>
    colors.map((color) => ({
      productId: tshirt.id,
      title: `${size} / ${color}`,
      sku: `SHIRT-${size}-${color.toUpperCase()}`,
    })),
  )

  const sweatshirtVariants = sizes.map((size) => ({
    productId: sweatshirt.id,
    title: size,
    sku: `SWEATSHIRT-${size}`,
  }))

  const sweatpantsVariants = sizes.map((size) => ({
    productId: sweatpants.id,
    title: size,
    sku: `SWEATPANTS-${size}`,
  }))

  const shortsVariants = sizes.map((size) => ({
    productId: shorts.id,
    title: size,
    sku: `SHORTS-${size}`,
  }))

  const createdVariants = await productService.createProductVariants([
    ...tshirtVariants,
    ...sweatshirtVariants,
    ...sweatpantsVariants,
    ...shortsVariants,
  ])
  console.info(`Seeded ${createdVariants.length} product variants`)

  // --- Images ---
  await productService.createProductImages([
    { productId: tshirt.id, url: 'https://placehold.co/600x400?text=T-Shirt+Front', rank: 0 },
    { productId: tshirt.id, url: 'https://placehold.co/600x400?text=T-Shirt+Back', rank: 1 },
    { productId: tshirt.id, url: 'https://placehold.co/600x400?text=T-Shirt+White+Front', rank: 2 },
    { productId: tshirt.id, url: 'https://placehold.co/600x400?text=T-Shirt+White+Back', rank: 3 },
    { productId: sweatshirt.id, url: 'https://placehold.co/600x400?text=Sweatshirt+Front', rank: 0 },
    { productId: sweatshirt.id, url: 'https://placehold.co/600x400?text=Sweatshirt+Back', rank: 1 },
    { productId: sweatpants.id, url: 'https://placehold.co/600x400?text=Sweatpants+Front', rank: 0 },
    { productId: sweatpants.id, url: 'https://placehold.co/600x400?text=Sweatpants+Back', rank: 1 },
    { productId: shorts.id, url: 'https://placehold.co/600x400?text=Shorts+Front', rank: 0 },
    { productId: shorts.id, url: 'https://placehold.co/600x400?text=Shorts+Back', rank: 1 },
  ])
  console.info('Seeded product images')

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
    const tshirtVariant = createdVariants.find((v) => v.sku === 'SHIRT-M-BLACK') as (typeof createdVariants)[number]
    const sweatshirtVariant = createdVariants.find((v) => v.sku === 'SWEATSHIRT-L') as (typeof createdVariants)[number]

    const [cart] = (await cartService.createCarts([
      {
        currencyCode: 'usd',
        email: 'test@example.com',
        items: [
          {
            title: 'Classic T-Shirt (M / Black)',
            quantity: 2,
            unitPrice: 2500,
            variantId: tshirtVariant.id,
            variantSku: tshirtVariant.sku,
            productId: tshirt.id,
            productTitle: 'Classic T-Shirt',
          },
          {
            title: 'Vintage Sweatshirt (L)',
            quantity: 1,
            unitPrice: 4500,
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
