import type { ICustomerModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import {
  AdminCustomerResponse,
  AdminUpdateCustomer,
  AdminUpdateCustomerResponse,
  DeleteResponse,
  IdParams,
} from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'

export const GetInput = { params: IdParams }
export const GetOutput = AdminCustomerResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  const customer = await customerService.retrieveCustomer(req.params.id)
  return { status: 200, json: { customer } }
}

export const PatchInput = { params: IdParams, body: AdminUpdateCustomer }
export const PatchOutput = AdminUpdateCustomerResponse

export const PATCH = async (req: HttpRequest<typeof PatchInput>): Promise<HttpResult<typeof PatchOutput>> => {
  const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  const customer = await customerService.updateCustomer(req.params.id, req.body)
  return { status: 200, json: { customer } }
}

export const DeleteInput = { params: IdParams }
export const DeleteOutput = DeleteResponse

export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  await customerService.softDeleteCustomers([req.params.id])
  return { status: 200, json: { id: req.params.id, deleted: true } }
}
