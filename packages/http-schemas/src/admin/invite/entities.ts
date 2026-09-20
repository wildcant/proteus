import { z } from 'zod'
import { dateToIso, timestamps } from '../../common.js'

export const AdminInvite = z
  .object({
    id: z.string(),
    email: z.string(),
    accepted: z.boolean(),
    token: z.string(),
    expiresAt: dateToIso,
    roleIds: z.array(z.string()).optional().default([]),
    ...timestamps.shape,
  })
  .openapi('AdminInvite')
export type AdminInvite = z.input<typeof AdminInvite>
