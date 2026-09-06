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
    // Obtaining a token cannot require one. `applyNamespaceAuth` already injects nothing outside
    // `/admin/` and `/store/`, so this only corrects what the spec says.
    auth: 'public',
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
    auth: 'public',
    returnsUnauthorized: true,
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
    auth: 'public',
    middlewares: authResetPasswordRoutes.PostMiddlewares,
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
    input: authPasswordRoutes.PostInput,
    middlewares: authPasswordRoutes.PostMiddlewares,
    operationId: 'authUpdatePassword',
    summary: 'Update password using a reset token',
    tags: [Tags.AUTH],
    output: authPasswordRoutes.PostOutput,
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
