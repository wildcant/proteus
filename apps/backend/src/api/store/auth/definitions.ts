import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as loginRoutes from './login/route.js'
import * as signupRoutes from './signup/route.js'

export default [
  {
    method: 'POST',
    matcher: '/store/auth/signup',
    handler: signupRoutes.POST,
    auth: 'public',
    returnsUnauthorized: true,
    input: signupRoutes.PostInput,
    operationId: 'storeAuthSignup',
    summary: 'Register a new customer account',
    tags: [Tags.AUTH],
    output: signupRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/store/auth/login',
    handler: loginRoutes.POST,
    auth: 'public',
    returnsUnauthorized: true,
    input: loginRoutes.PostInput,
    operationId: 'storeAuthLogin',
    summary: 'Login as a customer',
    tags: [Tags.AUTH],
    output: loginRoutes.PostOutput,
  },
] satisfies RouteDefinition[]
