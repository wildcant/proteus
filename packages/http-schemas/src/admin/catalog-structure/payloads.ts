import { z } from 'zod'
import { shortText } from '../../bounded.js'

export const AdminApplyCatalogStructure = z
  .object({
    /** The uploaded structure file (`estructura.yaml`) — upload it private. */
    fileId: shortText.min(1),
  })
  .openapi('AdminApplyCatalogStructure')
export type AdminApplyCatalogStructureBody = z.infer<typeof AdminApplyCatalogStructure>
