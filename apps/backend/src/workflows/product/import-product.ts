import { Buffer } from 'node:buffer'
import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { ImportedProductDTO } from '@core/types/product/common.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'
import { createProductWorkflow } from './create-product.js'
import { createProductVariantsWorkflow } from './create-product-variants.js'
import { updateVariantPricesWorkflow } from './update-variant-prices.js'
import {
  buildImportedProductFields,
  buildImportedVariant,
  type ExistingImportVariant,
  matchImportedVariants,
  mergeImportedOptions,
} from './utils/build-imported-product.js'

type ImportProductInput = {
  product: ImportedProductDTO
  overwrite: boolean
}

/** The product an import wrote, and which of its variants each imported variant became. */
type WrittenProduct = { productId: string; variants: Array<{ line: number; variantId: string }> } | null

type ImportProductOutput = { created: WrittenProduct; updated: WrittenProduct }

/** How long one image download may take before the product fails rather than the run hanging on it. */
const IMAGE_DOWNLOAD_TIMEOUT_MS = 30_000

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}

/**
 * One product of a CSV import: its groupings and options resolved (created where missing), then
 * created — or, with overwrite on, updated in place — then its images downloaded into file storage
 * and its stock set.
 *
 * A run imports products one workflow each, so a product that fails unwinds itself and nothing
 * else. On the create path that means the new product goes again. The overwrite path is not
 * undone: it writes what the merchant asked for, and running the same file again converges on it.
 * Groupings created along the way stay too — the next product, or the next run, finds them.
 *
 * Overwrite replaces the product's fields and groupings, adds the file's option values, updates the
 * variants it matches by SKU (else by combination), creates the ones it does not, and leaves
 * variants the file does not mention alone.
 */
export const importProductWorkflow = createWorkflow<ImportProductInput, ImportProductOutput>(
  {
    name: 'import-product',
    throws: [
      ...createProductWorkflow.throws,
      ...createProductVariantsWorkflow.throws,
      ...updateVariantPricesWorkflow.throws,
      // raised by this file's image download and by the module services it calls
      // ast-grep-ignore: workflow-declares-unthrown-error
      ErrorTypes.INVALID_DATA,
    ],
  },
  async (ctx, input) => {
    const references = await ctx.step('resolve-import-references', async ({ container }) => {
      const productService = container.resolve(Modules.PRODUCT)
      return productService.resolveProductImportReferences(input.product)
    })

    const created = await ctx.step<WrittenProduct>(
      'create-imported-product',
      async ({ container }) => {
        if (references.existingProductId) return null
        const { product } = input
        const productService = container.resolve(Modules.PRODUCT)

        const written = await createProductWorkflow.run({
          product: buildImportedProductFields(product, references),
          options: references.options,
          variants: product.variants.map((variant) => buildImportedVariant(variant, product, references)),
        })

        const variants = await productService.listProductVariants({ productId: written.id })
        const optionMaps = await productService.listVariantOptionMaps(variants.map((variant) => variant.id))
        const matched = matchImportedVariants(
          product,
          references,
          variants.map((variant) => ({ id: variant.id, sku: variant.sku, optionValues: optionMaps[variant.id] ?? {} })),
        )
        return {
          productId: written.id,
          variants: matched.flatMap(({ variant, variantId }) => (variantId ? [{ line: variant.line, variantId }] : [])),
        }
      },
      async (written, { container }) => {
        if (!written) return
        const productService = container.resolve(Modules.PRODUCT)
        await productService.softDeleteProducts([written.productId])
      },
    )

    const updated = await ctx.step<WrittenProduct>('overwrite-imported-product', async ({ container }) => {
      const productId = references.existingProductId
      if (!productId || !input.overwrite) return null
      const { product } = input
      const productService = container.resolve(Modules.PRODUCT)

      await productService.updateProduct(productId, buildImportedProductFields(product, references))

      const offered = await productService.listProductOptionsForProduct(productId)
      await productService.setProductOptions(productId, {
        options: mergeImportedOptions(
          offered.map((option) => ({ optionId: option.id, valueIds: option.values.map((value) => value.id) })),
          references,
        ),
      })

      const variants = await productService.listProductVariants({ productId })
      const optionMaps = await productService.listVariantOptionMaps(variants.map((variant) => variant.id))
      const existing: ExistingImportVariant[] = variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        optionValues: optionMaps[variant.id] ?? {},
      }))
      const matched = matchImportedVariants(product, references, existing)

      const kept = matched.flatMap(({ variant, variantId }) => (variantId ? [{ variant, variantId }] : []))
      for (const { variant, variantId } of kept) {
        const { prices, ...fields } = buildImportedVariant(variant, product, references)
        await productService.updateProductVariant(variantId, fields)
        if (prices?.length) await updateVariantPricesWorkflow.run({ variantId, data: { prices } })
      }

      const added = matched.flatMap(({ variant, variantId }) => (variantId ? [] : [variant]))
      const createdVariants =
        added.length > 0
          ? await createProductVariantsWorkflow.run({
              productId,
              variants: added.map((variant) => buildImportedVariant(variant, product, references)),
            })
          : []

      return {
        productId,
        variants: [
          ...kept.map(({ variant, variantId }) => ({ line: variant.line, variantId })),
          ...added.flatMap((variant, index) => {
            const variantId = createdVariants[index]?.id
            return variantId ? [{ line: variant.line, variantId }] : []
          }),
        ],
      }
    })

    await ctx.step<string[]>(
      'attach-imported-images',
      async ({ container }) => {
        const written = created ?? updated
        const { product } = input
        if (!written || product.imageUrls.length === 0) return []
        const fileService = container.resolve(Modules.FILE)
        const productService = container.resolve(Modules.PRODUCT)

        const downloads = await Promise.all(product.imageUrls.map((url) => downloadImage(url)))
        const files = await fileService.createFiles(
          downloads.map((download, index) => ({
            filename: `${product.handle}-${index + 1}.${download.extension}`,
            mimeType: download.mimeType,
            content: download.content,
            access: 'public',
          })),
        )
        const urlBySource = new Map(product.imageUrls.map((url, index) => [url, files[index]?.url ?? '']))

        await productService.updateProduct(written.productId, {
          images: files.map((file) => ({ url: file.url })),
          thumbnail: files[0]?.url ?? null,
        })

        const images = await productService.listProductImages({ productId: written.productId })
        const imageIdByUrl = new Map(images.map((image) => [image.url, image.id]))
        const variantLines = new Map(written.variants.map((entry) => [entry.line, entry.variantId]))
        const links = product.variants.flatMap((variant) => {
          const variantId = variantLines.get(variant.line)
          const imageId = variant.imageUrl ? imageIdByUrl.get(urlBySource.get(variant.imageUrl) ?? '') : undefined
          return variantId && imageId ? [{ variantId, imageId }] : []
        })
        if (links.length > 0) await productService.addImageToVariant(links)

        return files.map((file) => file.id)
      },
      async (fileIds, { container }) => {
        if (fileIds.length === 0) return
        await container.resolve(Modules.FILE).deleteFiles(fileIds)
      },
    )

    await ctx.step<Array<{ inventoryItemId: string; locationId: string; stockedQuantity: number }>>(
      'set-imported-stock',
      async ({ container }) => {
        const written = created ?? updated
        if (!written) return []
        const quantityByVariant = new Map(
          input.product.variants.flatMap((variant) => {
            const entry = written.variants.find((candidate) => candidate.line === variant.line)
            return entry && variant.manageInventory && variant.inventoryQuantity !== null
              ? [[entry.variantId, variant.inventoryQuantity] as const]
              : []
          }),
        )
        if (quantityByVariant.size === 0) return []

        const linkService = container.resolve(ContainerRegistrationKeys.LINK)
        const inventoryService = container.resolve(Modules.INVENTORY)
        const stockLocationService = container.resolve(Modules.STOCK_LOCATION)
        const [location] = await stockLocationService.listStockLocations(undefined, {
          order: { createdAt: 'ASC' },
          limit: 1,
        })
        if (!location) return []

        const links = await linkService
          .repo('productVariantInventoryItem')
          .findByVariantIds([...quantityByVariant.keys()])
        const levels = await inventoryService.listInventoryLevels({
          inventoryItemId: links.map((link) => link.inventoryItemId),
          locationId: location.id,
        })
        const previous = levels.map((level) => ({
          inventoryItemId: level.inventoryItemId,
          locationId: level.locationId,
          stockedQuantity: level.stockedQuantity,
        }))

        for (const link of links) {
          const quantity = quantityByVariant.get(link.variantId)
          if (quantity === undefined) continue
          await inventoryService.setInventoryLevelStockedQuantity(link.inventoryItemId, location.id, quantity)
        }
        return previous
      },
      async (previous, { container }) => {
        const inventoryService = container.resolve(Modules.INVENTORY)
        for (const level of previous) {
          await inventoryService.setInventoryLevelStockedQuantity(
            level.inventoryItemId,
            level.locationId,
            level.stockedQuantity,
          )
        }
      },
    )

    return { created, updated }
  },
)

/** One image off the merchant's host, refused unless it answers with an image. */
async function downloadImage(url: string): Promise<{ mimeType: string; extension: string; content: string }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(IMAGE_DOWNLOAD_TIMEOUT_MS) }).catch(() => null)
  const mimeType = response?.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
  const extension = IMAGE_EXTENSIONS[mimeType]
  if (!response?.ok || !extension) {
    throw new AppError({
      type: ErrorTypes.INVALID_DATA,
      message: i18n.t('The image "{url}" could not be downloaded.'),
      values: { url },
    })
  }
  return { mimeType, extension, content: Buffer.from(await response.arrayBuffer()).toString('base64') }
}
