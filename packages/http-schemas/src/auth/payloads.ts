import { z } from 'zod'
import { entityId, MAX_LENGTH, machineCode, opaqueToken, password } from '../bounded.js'

export const actorTypes = ['user', 'customer'] as const
export type ActorType = (typeof actorTypes)[number]

export const AuthParams = z.object({
  actorType: z.enum(actorTypes),
  authProvider: machineCode.min(1),
})
export type AuthParams = z.infer<typeof AuthParams>

// TODO: Define proper schema for auth body
// Until the shape is pinned down the values still need a ceiling — this is the login body, so
// every string in it is unauthenticated input. The token bound covers the longest thing any
// provider sends today (an email, a password, a signed assertion). The key stays unbounded:
// `additionalProperties` has no place in the spec for a key constraint, and a runtime rule the
// spec cannot state is the drift ILLO-77 spent a ticket removing.
export const AuthBody = z.record(z.string(), z.string().max(MAX_LENGTH.token)).openapi('AuthBody')
export type AuthBody = z.infer<typeof AuthBody>

export const VerificationConfirmBody = z
  .object({
    code: opaqueToken.min(1),
    codeProvider: machineCode.min(1).optional(),
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
    password: password.min(1, 'Enter a new password'),
  })
  .openapi('UpdatePasswordBody')
export type UpdatePasswordBody = z.infer<typeof UpdatePasswordBody>

export const VerificationRequestBody = z
  .object({
    entityId: entityId.min(1),
    entityType: machineCode.min(1),
    codeProvider: machineCode.min(1).default('token'),
    metadata: z.record(z.string(), z.unknown()).optional().default({}),
  })
  // Registered as ...Body, not ...Response: the response schema of the same name is a different
  // shape, and whichever registered second used to win — the spec documented `id` and
  // `requestedAt` as required request fields and omitted `codeProvider` and `metadata`.
  .openapi('VerificationRequestBody')
export type VerificationRequestBody = z.infer<typeof VerificationRequestBody>
