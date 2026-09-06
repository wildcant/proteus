import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as authRegisterRoutes from './[actorType]/[authProvider]/register/route.js'
import * as authResetPasswordRoutes from './[actorType]/[authProvider]/reset-password/route.js'
import * as authRoutes from './[actorType]/[authProvider]/route.js'
import * as authUpdateRoutes from './[actorType]/[authProvider]/update/route.js'
import * as tokenRefreshRoutes from './token/refresh/route.js'
import * as verificationConfirmRoutes from './verification/confirm/route.js'
import * as verificationRequestRoutes from './verification/request/route.js'

export default [
  {
    method: 'POST',
    matcher: '/auth/:actorType/:authProvider/register',
    handler: authRegisterRoutes.POST,
    middlewares: authRegisterRoutes.PostMiddlewares,
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
    middlewares: authRoutes.PostMiddlewares,
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
    middlewares: authResetPasswordRoutes.PostMiddlewares,
    input: authResetPasswordRoutes.PostInput,
    operationId: 'authResetPassword',
    summary: 'Request a password reset token',
    tags: [Tags.AUTH],
    output: authResetPasswordRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/auth/:actorType/:authProvider/update',
    handler: authUpdateRoutes.POST,
    middlewares: authUpdateRoutes.PostMiddlewares,
    input: authUpdateRoutes.PostInput,
    operationId: 'authUpdatePassword',
    summary: 'Update password using a reset token',
    tags: [Tags.AUTH],
    output: authUpdateRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/auth/token/refresh',
    handler: tokenRefreshRoutes.POST,
    middlewares: tokenRefreshRoutes.PostMiddlewares,
    operationId: 'authTokenRefresh',
    summary: 'Refresh an auth token',
    tags: [Tags.AUTH],
    output: tokenRefreshRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/auth/verification/request',
    handler: verificationRequestRoutes.POST,
    middlewares: verificationRequestRoutes.PostMiddlewares,
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
    middlewares: verificationConfirmRoutes.PostMiddlewares,
    input: verificationConfirmRoutes.PostInput,
    operationId: 'authVerificationConfirm',
    summary: 'Confirm a verification code',
    tags: [Tags.AUTH],
    output: verificationConfirmRoutes.PostOutput,
  },
] satisfies RouteDefinition[]
