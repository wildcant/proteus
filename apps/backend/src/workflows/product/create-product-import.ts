import { Buffer } from 'node:buffer'
import { ErrorTypes } from '@core/errors/app-error.js'
import type { ProductImportDTO, ProductImportOptionsDTO } from '@core/types/product/common.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow } from '@core/workflows/types.js'
import { ulid } from 'ulid'

type CreateProductImportInput = {
  /** The uploaded CSV, stored private. */
  fileId: string
  options: ProductImportOptionsDTO
  createdBy: string | null
}

/**
 * Previews a CSV import: reads the uploaded file once, stores its products as chunk files the run
 * will read, and records the job as `previewed` with its summary and every error.
 *
 * A file with errors is still recorded, so the admin can show them, but gets no chunks and cannot be
 * confirmed. The chunks are what confirming runs — the CSV is not read again.
 */
export const createProductImportWorkflow = createWorkflow<CreateProductImportInput, ProductImportDTO>(
  {
    name: 'create-product-import',
    // an unknown `fileId` is the file provider's NOT_FOUND; an oversized chunk is the file module's INVALID_DATA
    // ast-grep-ignore: workflow-declares-unthrown-error
    throws: [ErrorTypes.NOT_FOUND, ErrorTypes.INVALID_DATA],
  },
  async (ctx, input) => {
    const plan = await ctx.step(
      'plan-product-import',
      async ({ container }) => {
        const fileService = container.resolve(Modules.FILE)
        const productService = container.resolve(Modules.PRODUCT)
        const storeService = container.resolve(Modules.STORE)
        const regionService = container.resolve(Modules.REGION)

        const store = await storeService.resolveStore()
        const [defaultCurrency] = store
          ? await storeService.listStoreCurrencies({ storeId: store.id, isDefault: true })
          : []
        const regions = await regionService.listRegions()

        const { summary, errors, chunks } = await productService.planProductImport(
          await fileService.getDownloadStream(input.fileId),
          {
            ...input.options,
            defaultCurrency: defaultCurrency?.currencyCode ?? null,
            marketCurrencies: Object.fromEntries(
              regions.map((region) => [region.name.trim().toLowerCase(), region.currencyCode]),
            ),
          },
        )

        // Private: a catalogue's prices and stock are not for anyone holding a URL.
        const batch = ulid()
        const files = await fileService.createFiles(
          chunks.map((chunk, index) => ({
            filename: `product-import-${batch}-${index + 1}.json`,
            mimeType: 'application/json',
            content: Buffer.from(JSON.stringify(chunk)).toString('base64'),
            access: 'private',
          })),
        )

        return { summary, errors, chunks: files.map((file) => file.id) }
      },
      async ({ chunks }, { container }) => {
        if (chunks.length === 0) return
        await container.resolve(Modules.FILE).deleteFiles(chunks)
      },
    )

    const productImport = await ctx.step('create-product-import', async ({ container }) => {
      const productService = container.resolve(Modules.PRODUCT)
      return productService.createProductImport({ ...plan, ...input })
    })

    return productImport
  },
)
