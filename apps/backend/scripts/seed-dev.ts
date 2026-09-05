import fs from 'node:fs/promises'
import path from 'node:path'
import { BigNumber } from '../src/core/bignumber.js'
import type {
  IAuthModuleService,
  ICartModuleService,
  ICustomerModuleService,
  IFileModuleService,
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
const fileService = container.resolve<IFileModuleService>(Modules.FILE)
const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)
const cartService = container.resolve<ICartModuleService>(Modules.CART)
const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)
const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION)
const pricingService = container.resolve<IPricingModuleService>(Modules.PRICING)
const fulfillmentService = container.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

// --- Catalogue ---
// One catalogue drives products, option values, variants, prices and images, so a colourway is
// described once and everything downstream derives from it, including the list of photos to
// upload. Photos live in `seed-images/` (committed, see its README for provenance).
const APPAREL_SIZES = ['S', 'M', 'L', 'XL']
const SHOE_SIZES = ['4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14']

type CatalogEntry = {
  title: string
  handle: string
  description: string
  skuPrefix: string
  price: number
  /** Which global size option the product draws from. Garments and shoes do not share a scale. */
  sizeOption: 'Size' | 'Shoe Size'
  /** The subset of that option's values this product is stocked in. */
  sizes: string[]
  /** Colourway to its photos in gallery order. The first photo becomes that colourway's thumbnail. */
  colors: Record<string, string[]>
}

const CATALOG: CatalogEntry[] = [
  {
    title: 'Hoodie',
    handle: 'hoodie',
    description:
      "This hoodie is the perfect choice for comfort and warmth. Meticulously crafted from 100% cotton, the hoodie features a soft, plush fleece interior and a unisex sizing design. Soft and lightweight, it's sure to be your go-to for chilly days.",
    skuPrefix: 'HOODIE',
    price: 9000,
    sizeOption: 'Size',
    sizes: ['S', 'M', 'L', 'XL'],
    colors: {
      Green: ['hoodie-green-01.jpg', 'hoodie-green-02.jpg', 'hoodie-green-03.jpg'],
      Olive: ['hoodie-olive-01.jpg', 'hoodie-olive-02.jpg', 'hoodie-olive-03.jpg'],
      Ocean: ['hoodie-ocean-01.jpg', 'hoodie-ocean-02.jpg', 'hoodie-ocean-03.jpg'],
      Purple: ['hoodie-purple-01.jpg', 'hoodie-purple-02.jpg', 'hoodie-purple-03.jpg'],
      Red: ['hoodie-red-01.jpg', 'hoodie-red-02.jpg', 'hoodie-red-03.jpg'],
    },
  },
  {
    title: "Men's T-shirt",
    handle: 'mens-t-shirt',
    description:
      'Crafted from organic cotton, this classic T-shirt features a relaxed fit, crew neckline and timeless look. Enjoy the breathable comfort of 100% organic cotton.',
    skuPrefix: 'MENS-TSHIRT',
    price: 4000,
    sizeOption: 'Size',
    sizes: ['S', 'M', 'L', 'XL'],
    colors: {
      Green: ['mens-t-shirt-green-01.jpg', 'mens-t-shirt-green-02.jpg', 'mens-t-shirt-green-03.jpg'],
      Olive: ['mens-t-shirt-olive-01.jpg', 'mens-t-shirt-olive-02.jpg', 'mens-t-shirt-olive-03.jpg'],
      Ocean: ['mens-t-shirt-ocean-01.jpg', 'mens-t-shirt-ocean-02.jpg', 'mens-t-shirt-ocean-03.jpg'],
      Purple: ['mens-t-shirt-purple-01.jpg', 'mens-t-shirt-purple-02.jpg', 'mens-t-shirt-purple-03.jpg'],
      Red: ['mens-t-shirt-red-01.jpg', 'mens-t-shirt-red-02.jpg', 'mens-t-shirt-red-03.jpg'],
    },
  },
  {
    title: "Men's Crewneck",
    handle: 'mens-crewneck',
    description:
      "This high-quality crewneck is perfect for your everyday look. Made with 100% cotton, it's soft, comfortable, and undeniably stylish. Full sleeved for a classic look and effortlessly versatile, this cotton crewneck is a must-have in any wardrobe.",
    skuPrefix: 'MENS-CREW',
    price: 12000,
    sizeOption: 'Size',
    sizes: ['S', 'M', 'L'],
    colors: {
      Green: [
        'mens-crewneck-green-01.jpg',
        'mens-crewneck-green-02.jpg',
        'mens-crewneck-green-03.jpg',
        'mens-crewneck-green-04.jpg',
      ],
      Olive: [
        'mens-crewneck-olive-01.jpg',
        'mens-crewneck-olive-02.jpg',
        'mens-crewneck-olive-03.jpg',
        'mens-crewneck-olive-04.jpg',
      ],
      Ocean: [
        'mens-crewneck-ocean-01.jpg',
        'mens-crewneck-ocean-02.jpg',
        'mens-crewneck-ocean-03.jpg',
        'mens-crewneck-ocean-04.jpg',
      ],
      Purple: [
        'mens-crewneck-purple-01.jpg',
        'mens-crewneck-purple-02.jpg',
        'mens-crewneck-purple-03.jpg',
        'mens-crewneck-purple-04.jpg',
      ],
      Red: [
        'mens-crewneck-red-01.jpg',
        'mens-crewneck-red-02.jpg',
        'mens-crewneck-red-03.jpg',
        'mens-crewneck-red-04.jpg',
      ],
    },
  },
  {
    title: 'Sweatpants',
    handle: 'sweatpants',
    description:
      'Soft and comfortable sweatpants in stylish shades. They are perfect for lounging with their cozy stretch fabric that offers just the right amount of warmth. Enjoy the ultimate relaxation experience!',
    skuPrefix: 'SWEATPANTS',
    price: 3500,
    sizeOption: 'Size',
    sizes: ['S', 'M', 'L'],
    colors: {
      Green: ['sweatpants-green-01.jpg', 'sweatpants-green-02.jpg', 'sweatpants-green-03.jpg'],
      Olive: ['sweatpants-olive-01.jpg', 'sweatpants-olive-02.jpg', 'sweatpants-olive-03.jpg'],
      Ocean: ['sweatpants-ocean-01.jpg', 'sweatpants-ocean-02.jpg', 'sweatpants-ocean-03.jpg'],
      Purple: ['sweatpants-purple-01.jpg', 'sweatpants-purple-02.jpg', 'sweatpants-purple-03.jpg'],
      Red: ['sweatpants-red-01.jpg', 'sweatpants-red-02.jpg', 'sweatpants-red-03.jpg'],
    },
  },
  {
    title: 'Shorts',
    handle: 'shorts',
    description:
      'These shorts are designed to help you reach peak performance. Constructed with high performance nylon fabric in a variety of shades, they are built to last and provide maximum comfort.',
    skuPrefix: 'SHORTS',
    price: 4500,
    sizeOption: 'Size',
    sizes: ['S', 'M', 'L'],
    colors: {
      Green: ['shorts-green-01.jpg'],
      Olive: ['shorts-olive-01.jpg'],
      Ocean: ['shorts-ocean-01.jpg'],
      Purple: ['shorts-purple-01.jpg'],
      Red: ['shorts-red-01.jpg'],
    },
  },
  {
    title: 'High Top Sneakers',
    handle: 'high-top-sneakers',
    description:
      'These stylish and durable high top sneakers are perfect for any casual look, offering superior comfort and protection with their foam cushioning and reinforced heel support.',
    skuPrefix: 'HIGHTOP',
    price: 18000,
    sizeOption: 'Shoe Size',
    sizes: ['6', '7', '8', '9', '10'],
    colors: {
      White: ['high-top-sneakers-white-01.jpg'],
    },
  },
  {
    title: 'White Leather Sneakers',
    handle: 'white-leather-sneakers',
    description:
      'A pared-back leather sneaker on a cupsole, finished with a gum outsole. Understated enough for every day, sturdy enough to keep wearing.',
    skuPrefix: 'WHITELEATHER',
    price: 9000,
    sizeOption: 'Shoe Size',
    sizes: ['4', '5', '6', '7', '8'],
    colors: {
      White: ['white-leather-sneakers-white-01.jpg'],
    },
  },
  {
    title: 'Gray Leather Sneakers',
    handle: 'grey-leather-sneakers',
    description:
      'These gray leather sneakers combine comfort and style for the perfect professional look. The breathable leather material ensures breathability and provides a comfortable fit, perfect for the office and other formal occasions. The handmade design is stylish and guaranteed to last.',
    skuPrefix: 'GREYLEATHER',
    price: 100000,
    sizeOption: 'Shoe Size',
    sizes: ['4', '5', '6', '7', '8', '9', '10', '11', '12'],
    colors: {
      Grey: ['grey-leather-sneakers-grey-01.jpg'],
    },
  },
  {
    title: 'Gray Runners',
    handle: 'grey-runners',
    description:
      'These gray runners are the perfect choice for running enthusiasts. These shoes provide superior breathability and comfort, so you can run longer with less fatigue. The lightweight design and airy mesh material make these shoes durable and lightweight, giving you the support you need for peak performance.',
    skuPrefix: 'RUNNERS',
    price: 3000,
    sizeOption: 'Shoe Size',
    sizes: ['4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'],
    colors: {
      Grey: ['grey-runners-grey-01.jpg'],
    },
  },
  {
    title: 'Canvas Sneakers',
    handle: 'canvas-sneakers',
    description:
      'These high-quality canvas sneakers offer a comfortable fit and superior breathability, thanks to their cushioning midsoles and durable construction. An array of stylish colors adds to the appeal, making them perfect for casual wear. Slip them on and enjoy reliable performance and style that lasts.',
    skuPrefix: 'CANVAS',
    price: 4000,
    sizeOption: 'Shoe Size',
    sizes: ['4', '5', '6', '7', '8', '9', '10', '11', '12'],
    colors: {
      Green: ['canvas-sneakers-green-01.jpg'],
      Olive: ['canvas-sneakers-olive-01.jpg'],
      Ocean: ['canvas-sneakers-ocean-01.jpg'],
      Purple: ['canvas-sneakers-purple-01.jpg'],
      Red: ['canvas-sneakers-red-01.jpg'],
    },
  },
  {
    title: "Women's T-shirt",
    handle: 'womens-t-shirt',
    description:
      'Crafted from organic cotton, this classic T-shirt features a relaxed fit, crew neckline and timeless look. Enjoy the breathable comfort of 100% organic cotton.',
    skuPrefix: 'WOMENS-TSHIRT',
    price: 4000,
    sizeOption: 'Size',
    sizes: ['S', 'M', 'L', 'XL'],
    colors: {
      Green: ['womens-t-shirt-green-01.jpg'],
      Olive: ['womens-t-shirt-olive-01.jpg'],
      Ocean: ['womens-t-shirt-ocean-01.jpg'],
      Purple: ['womens-t-shirt-purple-01.jpg'],
      Red: ['womens-t-shirt-red-01.jpg'],
    },
  },
  {
    title: "Women's Crewneck",
    handle: 'womens-crewneck',
    description:
      "This high-quality crewneck is perfect for your everyday look. Made with 100% cotton, it's soft, comfortable, and undeniably stylish. Full sleeved for a classic look and effortlessly versatile, this cotton crewneck is a must-have in any wardrobe.",
    skuPrefix: 'WOMENS-CREW',
    price: 12000,
    sizeOption: 'Size',
    sizes: ['S', 'M', 'L'],
    colors: {
      Green: ['womens-crewneck-green-01.jpg', 'womens-crewneck-green-02.jpg', 'womens-crewneck-green-03.jpg'],
      Olive: ['womens-crewneck-olive-01.jpg', 'womens-crewneck-olive-02.jpg', 'womens-crewneck-olive-03.jpg'],
      Ocean: ['womens-crewneck-ocean-01.jpg', 'womens-crewneck-ocean-02.jpg', 'womens-crewneck-ocean-03.jpg'],
      Purple: ['womens-crewneck-purple-01.jpg', 'womens-crewneck-purple-02.jpg', 'womens-crewneck-purple-03.jpg'],
      Red: ['womens-crewneck-red-01.jpg', 'womens-crewneck-red-02.jpg', 'womens-crewneck-red-03.jpg'],
    },
  },
  {
    title: 'Workout Shirt',
    handle: 'workout-shirt',
    description:
      "This high-performance workout shirt made from high-quality Nylon is designed with comfort and durability in mind. Its breathable mesh construction keeps your body temperature regulated while you exercise, while the antistatic and antibacterial finish ensures it will remain light and soft to the touch, wash after wash. With its lightweight design and adjustable straps, it's sure to stay in place during even the toughest workouts.",
    skuPrefix: 'WORKOUT',
    price: 1000,
    sizeOption: 'Size',
    sizes: ['S', 'M', 'L'],
    colors: {
      Green: ['workout-shirt-green-01.jpg'],
      Olive: ['workout-shirt-olive-01.jpg'],
      Ocean: ['workout-shirt-ocean-01.jpg'],
      Purple: ['workout-shirt-purple-01.jpg'],
      Red: ['workout-shirt-red-01.jpg'],
    },
  },
  {
    title: 'Leggings',
    handle: 'leggings',
    description:
      'These sporty and lightweight leggings are designed for comfort and ease of movement. Its moisture-wicking fabric and strong seams keep you feeling cool and secure. Available in an array of colors, these leggings are an ideal choice to look stylish while exercising.',
    skuPrefix: 'LEGGINGS',
    price: 2000,
    sizeOption: 'Size',
    sizes: ['S', 'M', 'L'],
    colors: {
      Green: ['leggings-green-01.jpg', 'leggings-green-02.jpg'],
      Olive: ['leggings-olive-01.jpg', 'leggings-olive-02.jpg'],
      Ocean: ['leggings-ocean-01.jpg', 'leggings-ocean-02.jpg'],
      Purple: ['leggings-purple-01.jpg', 'leggings-purple-02.jpg'],
      Red: ['leggings-red-01.jpg', 'leggings-red-02.jpg'],
    },
  },
]

const galleryOf = (entry: CatalogEntry) => Object.values(entry.colors).flat()

// --- Seed images ---
const SEED_IMAGE_SOURCE_DIR = path.join(process.cwd(), 'seed-images')
const SEED_IMAGE_DIR = path.join(process.cwd(), 'static', 'seed')
// Mirrors the default in `src/providers/file-localfs/local-file-provider.ts`.
const STATIC_BASE_URL = 'http://localhost:3000/static'

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

// A photo shared by two colourways would otherwise be uploaded twice.
const SEED_IMAGES = [...new Set(CATALOG.flatMap(galleryOf))]

/**
 * Copies the photos into the gitignored `static/` root so they serve through the same `/static`
 * route as uploads. Keys stay stable, so re-seeding repairs a `static/` that was cleared or
 * half-populated.
 */
async function copySeedImages(): Promise<Map<string, string>> {
  await fs.mkdir(SEED_IMAGE_DIR, { recursive: true })

  await Promise.all(
    SEED_IMAGES.map((file) => fs.copyFile(path.join(SEED_IMAGE_SOURCE_DIR, file), path.join(SEED_IMAGE_DIR, file))),
  )

  console.info(`Copied ${SEED_IMAGES.length} seed images to ${SEED_IMAGE_DIR}`)
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
          content: (await fs.readFile(path.join(SEED_IMAGE_SOURCE_DIR, file))).toString('base64'),
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

const imageUrl = (file: string) => {
  const url = seedImageUrls.get(file)
  if (!url) throw new Error(`No seeded URL for image "${file}"`)
  return url
}

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

// --- Products ---
const existingProducts = await productService.listProducts()
if (existingProducts.length > 0) {
  console.info(`Skipped products (${existingProducts.length} already exist)`)
} else {
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
  // Colour ranks follow first appearance in the catalogue, which keeps the swatch order stable.
  const colorValues = [...new Set(CATALOG.flatMap((entry) => Object.keys(entry.colors)))]

  const apparelSizeOption = await productService.createProductOption({
    title: 'Size',
    values: APPAREL_SIZES.map((value, rank) => ({ value, rank })),
  })
  const shoeSizeOption = await productService.createProductOption({
    title: 'Shoe Size',
    values: SHOE_SIZES.map((value, rank) => ({ value, rank })),
  })
  const colorOption = await productService.createProductOption({
    title: 'Color',
    // Each colourway has its own photos, so the storefront draws this option as image swatches.
    renderAs: 'swatch',
    values: colorValues.map((value, rank) => ({ value, rank })),
  })
  console.info('Seeded global product options')

  const sizeOptionFor = (entry: CatalogEntry) => (entry.sizeOption === 'Shoe Size' ? shoeSizeOption : apparelSizeOption)

  // --- Link options to products ---
  // A product exposes only the sizes it is stocked in and the colourways it has photos for.
  type Option = { values: { id: string; value: string }[] }
  const valueIdFor = (option: Option, name: string) => option.values.find((value) => value.value === name)?.id
  const valueIdsFor = (option: Option, names: string[]) =>
    names.flatMap((name) => {
      const id = valueIdFor(option, name)
      return id ? [id] : []
    })

  await Promise.all(
    CATALOG.map((entry) =>
      productService.setProductOptions(productFor(entry).id, {
        // Colour first: payload order is the option's rank (`setProductOptions`), and rank is what
        // orders the storefront's pickers and the cart line's `Green · M`. The colourway decides
        // which photos the page shows, so it is the choice made before the size.
        options: [
          { optionId: colorOption.id, valueIds: valueIdsFor(colorOption, Object.keys(entry.colors)) },
          { optionId: sizeOptionFor(entry).id, valueIds: valueIdsFor(sizeOptionFor(entry), entry.sizes) },
        ],
      }),
    ),
  )
  console.info('Linked options to products')

  // --- Variants ---
  // Every product is now size x colour, so each variant maps onto exactly one colourway gallery.
  // Option values are free text, so anything non-alphanumeric would put a second separator inside
  // the SKU and make the prefix/size/colour split ambiguous to read back.
  const skuToken = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '')

  const variantSpecs = CATALOG.flatMap((entry) =>
    Object.keys(entry.colors).flatMap((color) =>
      entry.sizes.map((size) => ({
        entry,
        productId: productFor(entry).id,
        sku: `${entry.skuPrefix}-${skuToken(size)}-${skuToken(color)}`,
        size,
        color,
        price: entry.price,
      })),
    ),
  )

  // The option tuple rides along on the variant, so there is no second pass to link them.
  const optionValuesFor = (entry: CatalogEntry, size: string, color: string) => {
    const sizeOption = sizeOptionFor(entry)
    const sizeValueId = valueIdFor(sizeOption, size)
    const colorValueId = valueIdFor(colorOption, color)
    if (!sizeValueId || !colorValueId) throw new Error(`Missing option value for "${size} / ${color}"`)
    return { [sizeOption.id]: sizeValueId, [colorOption.id]: colorValueId }
  }

  const createdVariants = await productService.createProductVariants(
    // No title: it is derived from the Option Combination these values name.
    variantSpecs.map(({ entry, productId, sku, size, color }) => ({
      productId,
      sku,
      optionValues: optionValuesFor(entry, size, color),
    })),
  )
  console.info(`Seeded ${createdVariants.length} product variants with their option values`)

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

  // Create inventory levels (all items at a single default location with stock). One SKU is left
  // with nothing on hand so the storefront's sold-out option state is reachable without editing
  // the database by hand.
  const SOLD_OUT_SKU = 'MENS-TSHIRT-XL-GREEN'

  await inventoryService.createInventoryLevels(
    createdItems.map((item) => ({
      inventoryItemId: item.id,
      locationId: 'loc_default',
      stockedQuantity: item.sku === SOLD_OUT_SKU ? 0 : 100,
      reservedQuantity: 0,
      incomingQuantity: 0,
    })),
  )
  console.info(`Seeded ${createdItems.length} inventory levels (${SOLD_OUT_SKU} deliberately sold out)`)

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
    const tshirt = productByHandle.get('mens-t-shirt')
    const hoodie = productByHandle.get('hoodie')
    const tshirtVariant = createdVariants.find((v) => v.sku === 'MENS-TSHIRT-M-GREEN')
    const hoodieVariant = createdVariants.find((v) => v.sku === 'HOODIE-L-OLIVE')
    if (!tshirt || !hoodie || !tshirtVariant || !hoodieVariant) {
      throw new Error('Expected the seeded catalog to contain the cart line item variants')
    }

    const [cart] = (await cartService.createCarts([
      {
        currencyCode: 'usd',
        email: 'test@example.com',
        items: [
          {
            title: "Men's T-shirt (Green / M)",
            quantity: 2,
            unitPrice: new BigNumber(4000),
            variantId: tshirtVariant.id,
            variantSku: tshirtVariant.sku,
            productId: tshirt.id,
            productTitle: "Men's T-shirt",
          },
          {
            title: 'Hoodie (Olive / L)',
            quantity: 1,
            unitPrice: new BigNumber(9000),
            variantId: hoodieVariant.id,
            variantSku: hoodieVariant.sku,
            productId: hoodie.id,
            productTitle: 'Hoodie',
          },
        ],
      },
    ])) as [Awaited<ReturnType<typeof cartService.createCarts>>[number]]

    console.info(`Seeded cart ${cart.id} with 2 line items (total: $170.00)`)
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
        description: 'Order #1042 for $170.00 from customer@example.com.',
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
        description: "Men's T-shirt (Green / XL) has only 3 units remaining.",
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
