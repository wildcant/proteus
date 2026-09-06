import { z } from 'zod'
import { shortText } from '../../bounded.js'

export const CreateUser = z
  .object({
    name: shortText.min(1),
    email: z.email(),
  })
  .openapi('CreateUser')
export type CreateUserBody = z.infer<typeof CreateUser>

export const UpdateUser = z
  .object({
    name: shortText.min(1).optional(),
    email: z.email().optional(),
  })
  .openapi('UpdateUser')
export type UpdateUserBody = z.infer<typeof UpdateUser>
