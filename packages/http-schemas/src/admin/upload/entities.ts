import { z } from 'zod'

export const AdminFile = z
  .object({
    id: z.string(),
    url: z.string(),
  })
  .openapi('AdminFile')
export type AdminFile = z.input<typeof AdminFile>
