import { validateScopeProviderAssociation } from '@core/auth/utils/validate-scope-provider-association.js'
import { AuthParams, ResetPasswordBody, ResetPasswordResponse } from '@proteus/http-schemas/auth'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { requestPasswordResetWorkflow } from '@workflows/auth/request-password-reset.js'

export const PostInput = { body: ResetPasswordBody, params: AuthParams }
export const PostMiddlewares = [validateScopeProviderAssociation()] as const
export const PostOutput = ResetPasswordResponse
export const PostThrows = [...requestPasswordResetWorkflow.throws] as const

export const POST = async (
  req: HttpRequest<typeof PostInput, typeof PostMiddlewares>,
): Promise<HttpResult<typeof PostOutput>> => {
  const { actorType, authProvider } = req.params

  await requestPasswordResetWorkflow.run({
    email: req.body.email,
    actorType,
    authProvider,
  })

  // The same answer whether or not the email exists, so the response cannot be used to discover
  // which addresses have accounts. 200 rather than 201: nothing was created, an email was sent.
  return { status: 200, json: {} }
}
