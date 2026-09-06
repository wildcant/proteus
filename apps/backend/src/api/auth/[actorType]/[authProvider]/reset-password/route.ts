import { validateScopeProviderAssociation } from '@core/auth/utils/validate-scope-provider-association.js'
import { AuthParams, ResetPasswordBody, ResetPasswordResponse } from '@proteus/http-schemas/auth'
import type { HttpRequest, HttpResult } from '../../../../../server/ports.js'
import { requestPasswordResetWorkflow } from '../../../../../workflows/auth/request-password-reset.js'

export const PostInput = { body: ResetPasswordBody, params: AuthParams }
export const PostMiddlewares = [validateScopeProviderAssociation()] as const
export const PostOutput = ResetPasswordResponse

export const POST = async (
  req: HttpRequest<typeof PostInput, typeof PostMiddlewares>,
): Promise<HttpResult<typeof PostOutput>> => {
  const { actorType, authProvider } = req.params

  await requestPasswordResetWorkflow.run({
    email: req.body.email,
    actorType,
    authProvider,
  })

  // Always return 201 regardless of whether the email exists (no enumeration)
  return { status: 201, json: {} }
}
