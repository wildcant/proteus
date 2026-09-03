import { defineAppConfig } from '@core/config/index.js'
import type { InputConfig } from '@core/config/types.js'

/**
 * The raw input, exported alongside the loaded config so a second composition root can start from
 * the same project settings and change one of them — the Temporal Worker pins its own workflow
 * engine that way, and so does the test container.
 */
export const appConfigInput: InputConfig = {
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
}

export const appConfig = defineAppConfig(appConfigInput)
