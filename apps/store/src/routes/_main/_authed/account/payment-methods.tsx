import { createFileRoute } from '@tanstack/react-router'
import { paymentMethodsQueryOptions } from '#/features/account/api/payment-methods'
import { PaymentMethodsBook } from '#/features/account/components/payment-methods-book'

export const Route = createFileRoute('/_main/_authed/account/payment-methods')({
  // Fire-and-forget, the same as the address book's: the page header paints while the wallet is
  // still in flight, and the list renders its own skeleton. Not awaited, because reaching the
  // gateway to list cards is the slowest read in the account area.
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(paymentMethodsQueryOptions())
  },
  component: PaymentMethodsBook,
})
