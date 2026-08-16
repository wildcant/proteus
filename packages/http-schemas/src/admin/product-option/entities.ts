import { z } from 'zod'
import { dateToIso } from '../../common.js'

export const AdminProductOptionValue = z
  .object({
    id: z.string(),
    optionId: z.string(),
    value: z.string(),
    rank: z.number().nullable(),
    metadata: z.string().nullable(),
    createdAt: dateToIso,
    updatedAt: dateToIso,
  })
  .openapi('AdminProductOptionValue')
export type AdminProductOptionValue = z.input<typeof AdminProductOptionValue>

export const AdminProductOption = z
  .object({
    id: z.string(),
    title: z.string(),
    metadata: z.string().nullable(),
    values: z.array(AdminProductOptionValue),
    createdAt: dateToIso,
    updatedAt: dateToIso,
  })
  .openapi('AdminProductOption')
export type AdminProductOption = z.input<typeof AdminProductOption>
