import { z } from 'zod'

export const actorTypes = ['user', 'customer'] as const
export type ActorType = (typeof actorTypes)[number]

export const AuthParams = z.object({
  actorType: z.enum(actorTypes),
  authProvider: z.string().min(1),
})
export type AuthParams = z.infer<typeof AuthParams>

// TODO: Define proper schema for auth body
export const AuthBody = z.record(z.string(), z.string()).openapi('AuthBody')
export type AuthBody = z.infer<typeof AuthBody>

export const VerificationConfirmBody = z
  .object({
    code: z.string().min(1),
    codeProvider: z.string().min(1).optional(),
  })
  .openapi('VerificationConfirmBody')
export type VerificationConfirmBody = z.infer<typeof VerificationConfirmBody>

export const ResetPasswordBody = z
  .object({
    email: z.email(),
  })
  .openapi('ResetPasswordBody')
export type ResetPasswordBody = z.infer<typeof ResetPasswordBody>

export const UpdatePasswordBody = z
  .object({
    // Message set explicitly, as on StoreSignupBody: this schema also validates the
    // storefront's reset form, and Zod's default reads "Too small: expected string...".
    password: z.string().min(1, 'Enter a new password'),
  })
  .openapi('UpdatePasswordBody')
export type UpdatePasswordBody = z.infer<typeof UpdatePasswordBody>

export const VerificationRequestBody = z
  .object({
    entityId: z.string().min(1),
    entityType: z.string().min(1),
    codeProvider: z.string().min(1).default('token'),
    metadata: z.record(z.string(), z.unknown()).optional().default({}),
  })
  .openapi('VerificationRequestResponse')
export type VerificationRequestBody = z.infer<typeof VerificationRequestBody>
