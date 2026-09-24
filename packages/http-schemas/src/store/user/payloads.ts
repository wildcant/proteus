import { i18n } from '@proteus/utils'
import { z } from 'zod'
import { shortText } from '../../bounded.js'

export const CreateUser = z
  .object({
    name: shortText.min(1, i18n.t('Name is required')),
    email: z.email(i18n.t('Enter a valid email address')),
  })
  .openapi('CreateUser')
export type CreateUserBody = z.infer<typeof CreateUser>

export const UpdateUser = z
  .object({
    name: shortText.min(1, i18n.t('Name is required')).optional(),
    email: z.email(i18n.t('Enter a valid email address')).optional(),
  })
  .openapi('UpdateUser')
export type UpdateUserBody = z.infer<typeof UpdateUser>
