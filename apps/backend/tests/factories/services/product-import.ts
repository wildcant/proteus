import { Buffer } from 'node:buffer'
import { faker } from '@faker-js/faker'
import type { AppContainer } from '../../../src/core/types/container.js'
import type { ImportedProductDTO, ProductImportDTO } from '../../../src/core/types/product/common.js'
import { Modules } from '../../../src/core/utils/modules-definition.js'
import { generateImportedProductDTO } from '../product-dto.js'

type ProductImportOverrides = {
  products?: ImportedProductDTO[]
  createdBy?: string | null
}

const toBase64 = (text: string) => Buffer.from(text).toString('base64')

/**
 * A `previewed` import with its files in storage, as the preview route leaves one: the uploaded
 * CSV, and one chunk holding `products` (one generated product by default).
 */
export async function createProductImport(
  container: AppContainer,
  { products = [generateImportedProductDTO()], createdBy = null }: ProductImportOverrides = {},
): Promise<ProductImportDTO> {
  const fileService = container.resolve(Modules.FILE)
  const productService = container.resolve(Modules.PRODUCT)

  // Unique per call: the local provider keys by timestamp and name, and parallel workers share its directory.
  const suffix = faker.string.alphanumeric(10)
  const [csv, chunk] = await fileService.createFiles([
    {
      filename: `products-${suffix}.csv`,
      mimeType: 'text/csv',
      content: toBase64('Title,URL handle\n'),
      access: 'private',
    },
    {
      filename: `product-import-${suffix}.json`,
      mimeType: 'application/json',
      content: toBase64(JSON.stringify(products)),
      access: 'private',
    },
  ])
  if (!csv || !chunk) throw new Error('Expected both import files to be stored')

  return productService.createProductImport({
    fileId: csv.id,
    options: { overwrite: false, publish: true },
    summary: {
      products: { create: products.length, update: 0, skip: 0 },
      skus: products.reduce((total, product) => total + product.variants.length, 0),
      images: 0,
      willCreate: { tags: [], types: [] },
      ignoredColumns: [],
      metafields: [],
      firstProduct: products[0] ?? null,
    },
    errors: [],
    chunks: [chunk.id],
    createdBy,
  })
}

/** The same import, confirmed — `importing`, the state the run starts from. */
export async function createConfirmedProductImport(
  container: AppContainer,
  overrides?: ProductImportOverrides,
): Promise<ProductImportDTO> {
  const productImport = await createProductImport(container, overrides)
  return container.resolve(Modules.PRODUCT).confirmProductImport(productImport.id)
}

export async function retrieveProductImport(container: AppContainer, id: string): Promise<ProductImportDTO> {
  return container.resolve(Modules.PRODUCT).retrieveProductImport(id)
}

/** Whether storage still holds the file. */
export async function fileExists(container: AppContainer, id: string): Promise<boolean> {
  return container
    .resolve(Modules.FILE)
    .retrieveFile(id)
    .then(() => true)
    .catch(() => false)
}
