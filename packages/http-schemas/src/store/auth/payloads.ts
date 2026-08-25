import { z } from 'zod'

export const StoreSignupBody = z
  .object({
    email: z.email(),
    // Messages are set explicitly: without them Zod surfaces "Too small: expected string
    // to have >=1 characters" straight to the shopper.
    password: z.string().min(1, 'Enter a password'),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  })
  .openapi('StoreSignupBody')
export type StoreSignupBody = z.infer<typeof StoreSignupBody>

export const StoreLoginBody = z
  .object({
    email: z.email(),
    password: z.string().min(1, 'Enter your password'),
  })
  .openapi('StoreLoginBody')
export type StoreLoginBody = z.infer<typeof StoreLoginBody>
