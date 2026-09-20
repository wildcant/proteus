export type CreateInviteDTO = {
  email: string
  // TODO(RBAC): roles when RBAC is implemented
}

export type UpdateInviteDTO = {
  token?: string | undefined
  expiresAt?: Date | undefined
  accepted?: boolean | undefined
}
