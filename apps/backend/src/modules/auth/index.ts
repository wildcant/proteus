import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { loadAuthProviders } from './loaders/providers.js'
import * as models from './models/index.js'
import { AuthIdentityRepository } from './repositories/auth-identity.js'
import { AuthPasswordResetTokenRepository } from './repositories/auth-password-reset-token.js'
import { AuthVerificationRepository } from './repositories/auth-verification.js'
import { ProviderIdentityRepository } from './repositories/provider-identity.js'
import { AuthModuleService } from './services/auth-module-service.js'

export { authProviderDeclarations } from './provider-declarations.js'

export default Module(Modules.AUTH, {
  service: AuthModuleService,
  models,
  repositories: {
    authIdentityRepository: AuthIdentityRepository,
    providerIdentityRepository: ProviderIdentityRepository,
    authVerificationRepository: AuthVerificationRepository,
    authPasswordResetTokenRepository: AuthPasswordResetTokenRepository,
  },
  loaders: [loadAuthProviders],
})
