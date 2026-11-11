import { z } from 'zod'
import { AdminCatalogStructurePlan } from './entities.js'

export const AdminCatalogStructureResponse = z
  .object({ catalogStructure: AdminCatalogStructurePlan })
  .openapi('AdminCatalogStructureResponse')
export type AdminCatalogStructureResponse = z.input<typeof AdminCatalogStructureResponse>
