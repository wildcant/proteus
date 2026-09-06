import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IAuthModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { AuthenticateResponse } from '@proteus/http-schemas/auth'
import { StoreSignupBody } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { completeCustomerAuthWorkflow } from '@workflows/customer/complete-customer-auth.js'

export const PostInput = { body: StoreSignupBody }
export const PostOutput = AuthenticateResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const authService = req.scope.resolve<IAuthModuleService>(Modules.AUTH)
  const { email, password, firstName, lastName } = req.body

  const registerResult = await authService.register('emailpass', { body: { email, password } })
  if (!registerResult.success || !registerResult.authIdentity) {
    const isDuplicate = registerResult.error?.includes('already exists')
    throw new AppError({
      type: isDuplicate ? ErrorTypes.CONFLICT : ErrorTypes.INVALID_DATA,
      message: registerResult.error ?? 'Registration failed',
    })
  }

  const authenticateResult = await authService.authenticate('emailpass', { body: { email, password } })
  if (!authenticateResult.success || !authenticateResult.authIdentity) {
    throw new AppError({
      type: ErrorTypes.UNAUTHORIZED,
      message: authenticateResult.error ?? 'Authentication failed after registration',
    })
  }

  const result = await completeCustomerAuthWorkflow.run({
    authIdentityId: authenticateResult.authIdentity.id,
    authProvider: 'emailpass',
    customerData: { firstName, lastName, email },
  })

  return { status: 200, json: result }
}
