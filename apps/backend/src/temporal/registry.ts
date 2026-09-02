import { AppError, ErrorTypes } from '../core/errors/app-error.js'
import type { WorkflowDefinition } from '../core/workflows/types.js'
import { requestPasswordResetWorkflow } from '../workflows/auth/request-password-reset.js'
import { addToCartWorkflow } from '../workflows/cart/add-to-cart.js'
import { completeCartWorkflow } from '../workflows/cart/complete-cart.js'
import { confirmInventoryWorkflow } from '../workflows/cart/confirm-inventory-workflow.js'
import { transferCartCustomerWorkflow } from '../workflows/cart/transfer-cart-customer.js'
import { updateCartWorkflow } from '../workflows/cart/update-cart.js'
import { completeCustomerAuthWorkflow } from '../workflows/customer/complete-customer-auth.js'
import { createCustomerAccountWorkflow } from '../workflows/customer/create-customer-account.js'
import { deleteFilesWorkflow } from '../workflows/file/delete-files.js'
import { uploadFilesWorkflow } from '../workflows/file/upload-files.js'
import { cancelOrderWorkflow } from '../workflows/order/cancel-order.js'
import { createOrderFulfillmentWorkflow } from '../workflows/order/create-order-fulfillment.js'
import { createOrderShipmentWorkflow } from '../workflows/order/create-order-shipment.js'
import { markOrderDeliveredWorkflow } from '../workflows/order/mark-order-delivered.js'
import { createPaymentCollectionForCartWorkflow } from '../workflows/payment/create-payment-collection-for-cart.js'
import { batchImageVariantsWorkflow } from '../workflows/product/batch-image-variants.js'
import { batchVariantImagesWorkflow } from '../workflows/product/batch-variant-images.js'
import { createProductWorkflow } from '../workflows/product/create-product.js'
import { createProductVariantsWorkflow } from '../workflows/product/create-product-variants.js'
import { deleteProductVariantWorkflow } from '../workflows/product/delete-product-variant.js'
import { setProductOptionsWorkflow } from '../workflows/product/set-product-options.js'
import { updateProductVariantWorkflow } from '../workflows/product/update-product-variant.js'
import { updateVariantPricesWorkflow } from '../workflows/product/update-variant-prices.js'
import { acceptInviteWorkflow } from '../workflows/user/accept-invite.js'
import { createInviteWorkflow } from '../workflows/user/create-invite.js'
import { resendInviteWorkflow } from '../workflows/user/resend-invite.js'

/**
 * Name → handler, so the replay Activity can find a workflow it was only handed the *name* of.
 *
 * This is the half of the bridge that cannot travel: the driver Workflow runs in a sandbox and
 * carries a name, and the handler it names is an ordinary closure living in this process. Every
 * workflow the Temporal engine can run has to be here — an unregistered name fails the execution
 * non-retryably rather than falling back to something, because "the deploy forgot a workflow" and
 * "the workflow legitimately does not exist" look identical from inside the Activity.
 *
 * Deliberately not built by scanning `src/workflows/` at runtime: an import list is checked by the
 * type system and by `check:deps`, and a missing entry shows up as a failed execution with a name
 * in it rather than as a directory that silently resolved differently in another environment.
 */
export type WorkflowRegistry = {
  get(name: string): WorkflowDefinition<unknown, unknown> | undefined
  names(): string[]
}

export function createWorkflowRegistry(definitions: WorkflowDefinition<never, unknown>[]): WorkflowRegistry {
  const byName = new Map<string, WorkflowDefinition<unknown, unknown>>()

  for (const definition of definitions) {
    if (byName.has(definition.name)) {
      throw new AppError({
        type: ErrorTypes.UNEXPECTED_STATE,
        message: `[temporal] Two workflows are registered as "${definition.name}"`,
      })
    }
    byName.set(definition.name, definition as WorkflowDefinition<unknown, unknown>)
  }

  return {
    get: (name) => byName.get(name),
    names: () => [...byName.keys()],
  }
}

export const workflowRegistry = createWorkflowRegistry([
  requestPasswordResetWorkflow,
  addToCartWorkflow,
  completeCartWorkflow,
  confirmInventoryWorkflow,
  transferCartCustomerWorkflow,
  updateCartWorkflow,
  completeCustomerAuthWorkflow,
  createCustomerAccountWorkflow,
  deleteFilesWorkflow,
  uploadFilesWorkflow,
  cancelOrderWorkflow,
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
  markOrderDeliveredWorkflow,
  createPaymentCollectionForCartWorkflow,
  batchImageVariantsWorkflow,
  batchVariantImagesWorkflow,
  createProductWorkflow,
  createProductVariantsWorkflow,
  deleteProductVariantWorkflow,
  setProductOptionsWorkflow,
  updateProductVariantWorkflow,
  updateVariantPricesWorkflow,
  acceptInviteWorkflow,
  createInviteWorkflow,
  resendInviteWorkflow,
])
