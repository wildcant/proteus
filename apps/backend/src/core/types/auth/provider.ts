import type { AuthIdentityDTO, ProviderIdentityDTO } from './common.js'

export type AuthenticationInput = {
  body: Record<string, string>
}

export type AuthenticationResponse = {
  success: boolean
  authIdentity?: AuthIdentityDTO & {
    providerIdentities?: ProviderIdentityDTO[]
  }
  error?: string
}

export type AuthIdentityProviderService = {
  retrieve(selector: { entityId: string }): Promise<{
    authIdentity: AuthIdentityDTO
    providerIdentity: ProviderIdentityDTO
  } | null>
  create(data: {
    entityId: string
    providerMetadata?: Record<string, unknown> | null
    appMetadata?: Record<string, unknown> | null
  }): Promise<{
    authIdentity: AuthIdentityDTO
    providerIdentity: ProviderIdentityDTO
  }>
  update(
    entityId: string,
    data: {
      providerMetadata?: Record<string, unknown> | null
      appMetadata?: Record<string, unknown> | null
    },
  ): Promise<{
    authIdentity: AuthIdentityDTO
    providerIdentity: ProviderIdentityDTO
  }>
}

export type IAuthModuleProvider = {
  register(data: AuthenticationInput, authIdentityService: AuthIdentityProviderService): Promise<AuthenticationResponse>
  authenticate(
    data: AuthenticationInput,
    authIdentityService: AuthIdentityProviderService,
  ): Promise<AuthenticationResponse>
  update(
    data: Record<string, unknown>,
    authIdentityService: AuthIdentityProviderService,
  ): Promise<AuthenticationResponse>
  validateCallback(
    data: AuthenticationInput,
    authIdentityService: AuthIdentityProviderService,
  ): Promise<AuthenticationResponse>
}

type AuthProviderConfig = {
  resolve: { services: (new (...args: unknown[]) => unknown)[] }
  id: string
  options?: Record<string, unknown>
}

export type AuthModuleOptions = {
  providers?: AuthProviderConfig[]
  verification?: {
    providers?: AuthProviderConfig[]
  }
}
