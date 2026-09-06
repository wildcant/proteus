import { z } from 'zod'
import { opaqueToken, password, shortText } from '../../bounded.js'

export const AdminCreateInvite = z.object({
  email: z.email(),
  // TODO(RBAC): roles when RBAC is implemented
})
export type AdminCreateInvite = z.infer<typeof AdminCreateInvite>

export const AdminAcceptInvite = z.object({
  token: opaqueToken.min(1),
  name: shortText.min(1),
  password: password.min(1),
})
export type AdminAcceptInvite = z.infer<typeof AdminAcceptInvite>
