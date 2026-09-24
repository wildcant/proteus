export type CreateUserDTO = {
  id?: string
  email: string
  name: string
  locale: string
}

export type UpdateUserDTO = {
  email?: string | undefined
  name?: string | undefined
  locale?: string | undefined
}
