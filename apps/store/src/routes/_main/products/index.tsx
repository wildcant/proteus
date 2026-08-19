import { createFileRoute } from '@tanstack/react-router'
import { productsListQueryOptions } from '#/features/products/api/products'
import { ProductList } from '#/features/products/components/product-list'

export const Route = createFileRoute('/_main/products/')({
  component: ProductsPage,
  loader: ({ context }) => context.queryClient.ensureQueryData(productsListQueryOptions()),
})

function ProductsPage() {
  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <ProductList />
    </main>
  )
}
