import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { StoreNavigationResponse } from '@proteus/http-schemas/store'

export const GetOutput = StoreNavigationResponse

/** The menu as the last applied structure file has it. A deployment with no store has an empty one. */
export const GET = async (req: HttpRequest): Promise<HttpResult<typeof GetOutput>> => {
  const storeService = req.scope.resolve(Modules.STORE)
  const store = await storeService.resolveStore()
  return { status: 200, json: { navigation: store?.navigation ?? [] } }
}
