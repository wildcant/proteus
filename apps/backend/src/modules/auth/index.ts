import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { loadAuthProviders } from './loaders/providers.js'
import { authIdentityTable } from './models/auth-identity.js'
import { authPasswordResetTokenTable } from './models/auth-password-reset-token.js'
import { authVerificationTable } from './models/auth-verification.js'
import { providerIdentityTable } from './models/provider-identity.js'
import { AuthIdentityRepository } from './repositories/auth-identity.js'
import { AuthPasswordResetTokenRepository } from './repositories/auth-password-reset-token.js'
import { AuthVerificationRepository } from './repositories/auth-verification.js'
import { ProviderIdentityRepository } from './repositories/provider-identity.js'
import { AuthModuleService } from './services/auth-module-service.js'

export { authProviderDeclarations } from './provider-declarations.js'

export default Module(Modules.AUTH, {
  service: AuthModuleService,
  models: {
    authIdentityTable,
    authPasswordResetTokenTable,
    authVerificationTable,
    providerIdentityTable,
  },
  repositories: {
    authIdentityRepository: AuthIdentityRepository,
    providerIdentityRepository: ProviderIdentityRepository,
    authVerificationRepository: AuthVerificationRepository,
    authPasswordResetTokenRepository: AuthPasswordResetTokenRepository,
  },
  loaders: [loadAuthProviders],
})
