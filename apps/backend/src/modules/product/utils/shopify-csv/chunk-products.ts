import type { ImportedProductDTO } from '../../../../core/types/product/common.js'

/** Rows per chunk the run reads at a time. A chunk is cut only between products, so it can run over. */
const IMPORT_CHUNK_ROWS = 1000

/**
 * Splits products into chunks of about `maxRows` CSV rows each, never splitting a product, so the
 * run holds one chunk in memory rather than the whole file.
 */
export function chunkImportedProducts(
  products: ImportedProductDTO[],
  maxRows: number = IMPORT_CHUNK_ROWS,
): ImportedProductDTO[][] {
  const chunks: ImportedProductDTO[][] = []
  let current: ImportedProductDTO[] = []
  let rows = 0
  for (const product of products) {
    if (current.length > 0 && rows + product.rows > maxRows) {
      chunks.push(current)
      current = []
      rows = 0
    }
    current.push(product)
    rows += product.rows
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}
