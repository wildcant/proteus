export type CreateInviteDTO = {
  email: string
}

export type UpdateInviteDTO = {
  token?: string | undefined
  expiresAt?: Date | undefined
  accepted?: boolean | undefined
}
