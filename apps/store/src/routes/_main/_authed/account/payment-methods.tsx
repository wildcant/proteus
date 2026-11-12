import { createFileRoute } from '@tanstack/react-router'
import { paymentMethodsQueryOptions } from '#/entities/payment-method/api/payment-methods'
import { PaymentMethodsBook } from '#/features/account/components/payment-methods-book'
import { flowLinks } from '#/navigation/links'

const links = flowLinks('PaymentMethodsBook')
const paymentMethodsLinks = { account: links.BACK_TO_ACCOUNT(), startShopping: links.START_SHOPPING() }

export const Route = createFileRoute('/_main/_authed/account/payment-methods')({
  // Fire-and-forget, the same as the address book's: the page header paints while the wallet is
  // still in flight, and the list renders its own skeleton. Not awaited, because reaching the
  // gateway to list cards is the slowest read in the account area.
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(paymentMethodsQueryOptions())
  },
  component: PaymentMethodsPage,
})

function PaymentMethodsPage() {
  return <PaymentMethodsBook links={paymentMethodsLinks} />
}
