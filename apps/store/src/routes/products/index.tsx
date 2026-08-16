import { createFileRoute } from '@tanstack/react-router'
import { productsListQueryOptions } from '#/features/products/api/products'
import { ProductList } from '#/features/products/components/product-list'

export const Route = createFileRoute('/products/')({
  component: ProductsPage,
  loader: ({ context }) => context.queryClient.ensureQueryData(productsListQueryOptions()),
})

function ProductsPage() {
  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <section className="island-shell rise-in rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
        <p className="island-kicker mb-3">Product Module</p>
        <h1 className="display-title mb-5 text-4xl font-bold tracking-tight text-(--sea-ink)">Products</h1>
        <p className="mb-6 text-(--sea-ink-soft)">
          Using generated <code className="rounded bg-black/5 px-1.5 py-0.5 text-sm">React Query</code> hooks — calls
          the Store API over HTTP
        </p>
        <ProductList />
      </section>
    </main>
  )
}
