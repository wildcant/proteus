import {
  usePaymentMethods,
  useRemovePaymentMethod,
  useSetDefaultPaymentMethod,
} from '#/features/account/api/payment-methods'
import { PaymentMethodsBookView } from './payment-methods-book-view'

/**
 * The account wallet.
 *
 * List, remove, nominate a default — and deliberately no way to add a card. Adding one outside a
 * purchase means a SetupIntent flow, which is its own feature; here a card is saved by paying
 * with it, which is what the empty state says rather than leaving the shopper looking for a
 * button that does not exist.
 *
 * The rows are the checkout selector's rows, and the order is the backend's. Neither is a
 * coincidence: a shopper whose account page and checkout disagree about their cards has been
 * given two wallets.
 *
 * Everything this renders is `PaymentMethodsBookView`, in its own file so that mounting the page
 * does not pull the query layer — and its `env` — in with it. That is what lets the states worth
 * asserting be a component test rather than a stubbed endpoint.
 */
export function PaymentMethodsBook() {
  const { methods, isLoading, failed, refetch } = usePaymentMethods()
  const removeMethod = useRemovePaymentMethod()
  const setDefault = useSetDefaultPaymentMethod()

  return (
    <PaymentMethodsBookView
      methods={methods}
      isLoading={isLoading}
      failed={failed}
      onRetry={refetch}
      onSetDefault={(methodId) => setDefault.mutate(methodId)}
      onRemove={(methodId) => removeMethod.mutateAsync(methodId).then(() => undefined)}
    />
  )
}
