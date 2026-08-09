import { defineAppConfig } from '@core/config/index.js'

export const appConfig = defineAppConfig({
  projectConfig: {
    http: {
      /**
       * Controls which auth providers each actor type can use.
       * Enforced by `validateScopeProviderAssociation` middleware.
       * If absent for an actor type, all providers are allowed.
       */
      authMethodsPerActor: {
        user: ['emailpass'],
        customer: ['emailpass'],
      },

      /**
       * Controls which actor types require entity verification (e.g., email)
       * and with which auth providers. Checked by `generateJwtTokenWithChecks`
       * at login and token refresh. If absent for an actor type, no verification required.
       */
      authVerificationsPerActor: {
        customer: [{ entityType: 'email', authProvider: 'emailpass' }],
      },
    },
  },
})
