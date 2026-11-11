import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { productImportQueryOptions, useSuspenseProductImport } from '#/features/products/api/product-imports'
import { ImportProducts } from '#/features/products/components/import-products/import-products'

export const Route = createFileRoute('/_authed/_shell/products/import')({
  // `id` reopens a job already on file — the import-finished notification links here with it.
  validateSearch: z.object({ id: z.string().optional() }),
  loaderDeps: ({ search }) => ({ id: search.id }),
  loader: ({ context, deps }) =>
    deps.id ? context.queryClient.ensureQueryData(productImportQueryOptions(deps.id)) : undefined,
  component: ImportProductsRoute,
})

function ImportProductsRoute() {
  const { id } = Route.useSearch()

  return <RouteFocusModal>{id ? <ResumedImport key={id} id={id} /> : <ImportProducts />}</RouteFocusModal>
}

function ResumedImport({ id }: { id: string }) {
  const { data } = useSuspenseProductImport(id)
  return <ImportProducts productImport={data.productImport} />
}
