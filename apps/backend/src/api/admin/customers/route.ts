import type { ICustomerModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import {
  AdminCreateCustomers,
  AdminCreateCustomersResponse,
  AdminCustomerListParams,
  AdminCustomerListResponse,
} from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'

export const GetInput = { query: AdminCustomerListParams }
export const GetOutput = AdminCustomerListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  const { pagination, filters } = req.validatedQuery
  const [customers, count] = await customerService.listAndCountCustomers(filters, pagination)
  const { offset, limit } = pagination
  return { status: 200, json: { customers, count, offset, limit } }
}

export const PostInput = { body: AdminCreateCustomers }
export const PostOutput = AdminCreateCustomersResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  const customers = await customerService.createCustomers(req.body)
  return { status: 201, json: { customers } }
}
