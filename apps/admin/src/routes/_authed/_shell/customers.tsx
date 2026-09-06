import { createFileRoute } from '@tanstack/react-router'
import { customersListQueryOptions } from '#/features/customers/api/customers'
import { CreateCustomerForm } from '#/features/customers/components/create-customer-form.tsx'
import { CustomerList } from '#/features/customers/components/customer-list.tsx'

export const Route = createFileRoute('/_authed/_shell/customers')({
  component: CustomersPage,
  loader: ({ context }) => context.queryClient.ensureQueryData(customersListQueryOptions({ limit: 5, offset: 0 })),
})

function CustomersPage() {
  return (
    <main className="page-wrap px-4 pt-14 pb-8">
      <section className="island-shell rise-in rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
        <p className="island-kicker mb-3">Customer Module</p>
        <h1 className="display-title mb-5 font-bold text-(--sea-ink) text-4xl tracking-tight">Customers</h1>
        <p className="mb-6 text-(--sea-ink-soft)">
          Using generated <code className="rounded bg-black/5 px-1.5 py-0.5 text-sm">React Query</code> hooks — calls
          the JSON API over HTTP
        </p>

        <CreateCustomerForm />
        <CustomerList />
      </section>
    </main>
  )
}
