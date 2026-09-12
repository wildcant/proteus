import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { CreatePaymentCollection, StoreCreatePaymentCollectionResponse } from '@proteus/http-schemas/store'
import { createPaymentCollectionForCartWorkflow } from '@workflows/payment/create-payment-collection-for-cart.js'

export const PostInput = { body: CreatePaymentCollection }
export const PostOutput = StoreCreatePaymentCollectionResponse
export const PostThrows = [...createPaymentCollectionForCartWorkflow.throws] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const paymentCollection = await createPaymentCollectionForCartWorkflow.run({ cartId: req.body.cartId })

  return { status: 201, json: { paymentCollection } }
}
