import { CreatePaymentCollection, StoreCreatePaymentCollectionResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { createPaymentCollectionForCartWorkflow } from '@workflows/payment/create-payment-collection-for-cart.js'

export const PostInput = { body: CreatePaymentCollection }
export const PostOutput = StoreCreatePaymentCollectionResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const paymentCollection = await createPaymentCollectionForCartWorkflow.run({ cartId: req.body.cartId })

  return { status: 201, json: { paymentCollection } }
}
