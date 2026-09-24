import { z } from 'zod'
import { shortText } from '../../bounded.js'
import { localeCode } from '../region/payloads.js'

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

/**
 * What a staff member changes about themselves. Separate from `AdminUpdateUser` because only the
 * signed-in user sets their own Locale; nobody sets it for them from the users page.
 */
export const AdminUpdateMe = z
  .object({
    locale: localeCode,
  })
  .openapi('AdminUpdateMe')
export type AdminUpdateMeBody = z.infer<typeof AdminUpdateMe>
