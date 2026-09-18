type AuthorizationActor = {
  id: string
  grants: string[]
  unrestricted?: boolean
}

export type Context = {
  transaction?: unknown
  actor?: AuthorizationActor
}
