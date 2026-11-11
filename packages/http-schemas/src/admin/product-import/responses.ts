import { z } from 'zod'
import { AdminProductImport } from './entities.js'

export const AdminProductImportResponse = z
  .object({ productImport: AdminProductImport })
  .openapi('AdminProductImportResponse')
export type AdminProductImportResponse = z.input<typeof AdminProductImportResponse>
