import { i18n } from '@proteus/utils'
import { z } from 'zod'
import { password, shortText } from '../../bounded.js'

export const StoreSignupBody = z
  .object({
    email: z.email(i18n.t('Enter a valid email address')),
    // Messages are set explicitly: without them Zod surfaces "Too small: expected string
    // to have >=1 characters" straight to the shopper.
    password: password.min(1, i18n.t('Enter a password')),
    firstName: shortText.optional(),
    lastName: shortText.optional(),
  })
  .openapi('StoreSignupBody')
export type StoreSignupBody = z.infer<typeof StoreSignupBody>

export const StoreLoginBody = z
  .object({
    email: z.email(i18n.t('Enter a valid email address')),
    password: password.min(1, i18n.t('Enter your password')),
  })
  .openapi('StoreLoginBody')
export type StoreLoginBody = z.infer<typeof StoreLoginBody>
