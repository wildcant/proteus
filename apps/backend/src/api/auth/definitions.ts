import { validateScopeProviderAssociation } from '@core/auth/utils/validate-scope-provider-association.js'
import { validateToken } from '@core/auth/utils/validate-token.js'
import { authenticate } from '@framework/http/middlewares/authenticate.js'
import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as authPasswordRoutes from './[actorType]/[authProvider]/password/route.js'
import * as authRegisterRoutes from './[actorType]/[authProvider]/register/route.js'
import * as authResetPasswordRoutes from './[actorType]/[authProvider]/reset-password/route.js'
import * as authRoutes from './[actorType]/[authProvider]/route.js'
import * as tokenRefreshRoutes from './token/refresh/route.js'
import * as verificationConfirmRoutes from './verification/confirm/route.js'
import * as verificationRequestRoutes from './verification/request/route.js'

export default [
  {
    method: 'POST',
    matcher: '/auth/:actorType/:authProvider/register',
    handler: authRegisterRoutes.POST,
    middlewares: [validateScopeProviderAssociation()],
    input: authRegisterRoutes.PostInput,
    operationId: 'authRegister',
    summary: 'Register with an auth provider',
    tags: [Tags.AUTH],
    output: authRegisterRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/auth/:actorType/:authProvider',
    handler: authRoutes.POST,
    middlewares: [validateScopeProviderAssociation()],
    input: authRoutes.PostInput,
    operationId: 'authAuthenticate',
    summary: 'Authenticate with an auth provider',
    tags: [Tags.AUTH],
    output: authRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/auth/:actorType/:authProvider/reset-password',
    handler: authResetPasswordRoutes.POST,
    middlewares: [validateScopeProviderAssociation()],
    input: authResetPasswordRoutes.PostInput,
    operationId: 'authResetPassword',
    summary: 'Request a password reset token',
    tags: [Tags.AUTH],
    output: authResetPasswordRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/auth/:actorType/:authProvider/password',
    handler: authPasswordRoutes.POST,
    middlewares: [validateScopeProviderAssociation(), validateToken()],
    input: authPasswordRoutes.PostInput,
    operationId: 'authUpdatePassword',
    summary: 'Update password using a reset token',
    tags: [Tags.AUTH],
    output: authPasswordRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/auth/token/refresh',
    handler: tokenRefreshRoutes.POST,
    middlewares: [authenticate('*', { allowUnregistered: true })],
    operationId: 'authTokenRefresh',
    summary: 'Refresh an auth token',
    tags: [Tags.AUTH],
    output: tokenRefreshRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/auth/verification/request',
    handler: verificationRequestRoutes.POST,
    middlewares: [authenticate('*', { allowUnregistered: true })],
    input: verificationRequestRoutes.PostInput,
    operationId: 'authVerificationRequest',
    summary: 'Request a verification code',
    tags: [Tags.AUTH],
    output: verificationRequestRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/auth/verification/confirm',
    handler: verificationConfirmRoutes.POST,
    middlewares: [authenticate('*', { allowUnregistered: true })],
    input: verificationConfirmRoutes.PostInput,
    operationId: 'authVerificationConfirm',
    summary: 'Confirm a verification code',
    tags: [Tags.AUTH],
    output: verificationConfirmRoutes.PostOutput,
  },
] satisfies RouteDefinition[]
