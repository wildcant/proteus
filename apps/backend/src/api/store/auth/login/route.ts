import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IAuthModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { AuthenticateResponse } from '@proteus/http-schemas/auth'
import { StoreLoginBody } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { completeCustomerAuthWorkflow } from '@workflows/customer/complete-customer-auth.js'

export const PostInput = { body: StoreLoginBody }
export const PostOutput = AuthenticateResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const authService = req.scope.resolve<IAuthModuleService>(Modules.AUTH)
  const { email, password } = req.body

  const authenticateResult = await authService.authenticate('emailpass', { body: { email, password } })
  if (!authenticateResult.success || !authenticateResult.authIdentity) {
    throw new AppError({
      type: ErrorTypes.UNAUTHORIZED,
      message: authenticateResult.error ?? 'Invalid email or password',
    })
  }

  const result = await completeCustomerAuthWorkflow.run({
    authIdentityId: authenticateResult.authIdentity.id,
    authProvider: 'emailpass',
  })

  return { status: 200, json: result }
}
