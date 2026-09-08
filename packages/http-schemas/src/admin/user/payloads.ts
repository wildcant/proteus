import { z } from 'zod'
import { shortText } from '../../bounded.js'

export const AdminCreateUser = z
  .object({
    name: shortText.min(1),
    email: z.email(),
  })
  .openapi('AdminCreateUser')
export type AdminCreateUserBody = z.infer<typeof AdminCreateUser>

export const AdminUpdateUser = z
  .object({
    name: shortText.min(1).optional(),
    email: z.email().optional(),
  })
  .openapi('AdminUpdateUser')
export type AdminUpdateUserBody = z.infer<typeof AdminUpdateUser>
