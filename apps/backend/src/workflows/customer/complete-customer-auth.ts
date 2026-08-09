import {
  generateJwtTokenForAuthIdentity,
  generateJwtTokenWithChecks,
  getAuthJwtConfig,
} from '@core/auth/utils/generate-jwt-token.js'
import type { ConfigModule } from '@core/config/types.js'
import type { IAuthModuleService } from '@core/types/auth/service.js'
import type { CreateCustomerDTO } from '@core/types/customer/mutations.js'
import type { INotificationModuleService } from '@core/types/notification/service.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { sendVerificationEmail } from '../auth/send-verification-email.js'
import { createCustomerAccountWorkflow } from './create-customer-account.js'

export type CompleteCustomerAuthInput = {
  authIdentityId: string
  authProvider: string
  customerData?: Omit<CreateCustomerDTO, 'addresses'>
}

type CompleteCustomerAuthOutput = {
  token: string
  verificationRequired?: true
}

type VerificationCheckResult =
  | { verified: true; token: string; hasCustomer: boolean }
  | { verified: false; token: string; email: string; verificationCode: string }

export const completeCustomerAuthWorkflow = createWorkflow<CompleteCustomerAuthInput, CompleteCustomerAuthOutput>(
  'complete-customer-auth',
  async (ctx, input) => {
    const verificationCheck = await ctx.step<VerificationCheckResult>('check-verification', async ({ container }) => {
      const authService = container.resolve<IAuthModuleService>(Modules.AUTH)
      const config = container.resolve<ConfigModule>(ContainerRegistrationKeys.CONFIG_MODULE)
      const jwtConfig = getAuthJwtConfig()

      const { authIdentity } = await authService.validateAuthIdentity(input.authIdentityId, input.authProvider)

      const tokenResult = await generateJwtTokenWithChecks(
        authService,
        { authIdentity, actorType: 'customer', authProvider: input.authProvider },
        jwtConfig,
        config.projectConfig.http.authVerificationsPerActor,
      )

      if (tokenResult.verificationRequired) {
        // Store pending customer fields for later (signup path only)
        if (input.customerData) {
          const currentMetadata = authIdentity.appMetadata ?? {}
          await authService.updateAuthIdentity(authIdentity.id, {
            appMetadata: { ...currentMetadata, pending: input.customerData },
          })
        }

        // Find the entityId (email) from the provider identity
        const providerIdentity = authIdentity.providerIdentities.find((p) => p.provider === input.authProvider)
        if (!providerIdentity) {
          throw new WorkflowTerminalError(
            `Provider identity for "${input.authProvider}" not found on auth identity "${authIdentity.id}"`,
          )
        }

        const verificationResult = await authService.requestAuthVerification({
          authIdentityId: authIdentity.id,
          entityId: providerIdentity.entityId,
          entityType: 'email',
          codeProvider: 'token',
        })

        return {
          verified: false as const,
          token: tokenResult.token,
          email: providerIdentity.entityId,
          verificationCode: verificationResult.code ?? '',
        }
      }

      const hasCustomer = authIdentity.appMetadata?.customerId != null
      return { verified: true as const, token: tokenResult.token, hasCustomer }
    })

    if (!verificationCheck.verified) {
      await ctx.step('send-verification-email', async ({ container }) => {
        const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION)
        await sendVerificationEmail(notificationService, verificationCheck.email, verificationCheck.verificationCode)
      })
    }

    const result = await ctx.step<CompleteCustomerAuthOutput>('reconcile-customer', async ({ container }) => {
      if (!verificationCheck.verified) {
        return { token: verificationCheck.token, verificationRequired: true as const }
      }

      if (verificationCheck.hasCustomer) {
        return { token: verificationCheck.token }
      }

      // Create customer record (first login after verification, or signup without verification)
      const authService = container.resolve<IAuthModuleService>(Modules.AUTH)
      const jwtConfig = getAuthJwtConfig()

      // Determine customer data: from input (signup) or from appMetadata.pending (post-verification login)
      const { authIdentity } = await authService.validateAuthIdentity(input.authIdentityId, input.authProvider)
      const pending = authIdentity.appMetadata?.pending as Omit<CreateCustomerDTO, 'addresses'> | undefined
      const customerData = input.customerData ?? pending

      if (!customerData) {
        throw new WorkflowTerminalError(
          `No customer data available for auth identity "${input.authIdentityId}". ` +
            'Expected either input.customerData or appMetadata.pending.',
        )
      }

      await createCustomerAccountWorkflow.run({
        authIdentityId: input.authIdentityId,
        customerData: { firstName: customerData.firstName, lastName: customerData.lastName, email: customerData.email },
      })

      // Clean up pending data from appMetadata
      if (pending) {
        const freshIdentity = await authService.retrieveAuthIdentity(input.authIdentityId)
        const { pending: _removed, ...cleanedMetadata } = (freshIdentity.appMetadata ?? {}) as Record<string, unknown>
        await authService.updateAuthIdentity(input.authIdentityId, { appMetadata: cleanedMetadata })
      }

      // Re-retrieve to get the updated appMetadata with customerId
      const updated = await authService.validateAuthIdentity(input.authIdentityId, input.authProvider)
      const token = generateJwtTokenForAuthIdentity(
        { authIdentity: updated.authIdentity, actorType: 'customer', authProvider: input.authProvider },
        jwtConfig,
      )
      return { token }
    })

    return result
  },
)
