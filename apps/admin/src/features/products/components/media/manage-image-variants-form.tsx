import { Button, KeyboundForm, RouteDrawer, toast, useRouteModal } from '@proteus/ui'
import type { AdminProductImage } from '#/api/generated/model'
import { DataTable } from '#/components/data-table'
import { useImageVariantsTable } from '#/features/products/hooks/use-image-variants-table'
import { useManageImageVariantsForm } from '#/features/products/hooks/use-manage-image-variants-form'

type ManageImageVariantsFormProps = {
  productId: string
  image: AdminProductImage
  /** The variants the image is currently assigned to. */
  variantIds: string[]
}

export function ManageImageVariantsForm({ productId, image, variantIds }: ManageImageVariantsFormProps) {
  const { handleSuccess } = useRouteModal()

  const { form, isLoading } = useManageImageVariantsForm({
    productId,
    imageId: image.id,
    variantIds,
    onSuccess: () => {
      toast.add({ type: 'success', title: 'Image variants updated successfully' })
      handleSuccess()
    },
  })

  return (
    <RouteDrawer.Form form={form}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        <RouteDrawer.Header>
          <div className="flex items-center gap-x-3">
            <img src={image.url} alt="" className="size-10 shrink-0 rounded-md border object-cover" />
            <div className="flex flex-col gap-y-1">
              <RouteDrawer.Title>Manage variants</RouteDrawer.Title>
              <RouteDrawer.Description>Manage associated variants for the image</RouteDrawer.Description>
            </div>
          </div>
        </RouteDrawer.Header>
        <RouteDrawer.Body className="flex flex-col overflow-hidden p-0">
          <form.Field name="variantIds">
            {(field) => (
              <VariantSelectionTable
                productId={productId}
                imageUrl={image.url}
                value={field.state.value}
                onChange={field.handleChange}
              />
            )}
          </form.Field>
        </RouteDrawer.Body>
        <RouteDrawer.Footer className="justify-between">
          <form.Subscribe selector={(state) => state.values.variantIds.length}>
            {(count) => <span className="text-muted-foreground text-sm">{count} selected</span>}
          </form.Subscribe>
          <div className="flex items-center gap-x-2">
            <RouteDrawer.Close render={<Button variant="secondary" size="sm" />}>Cancel</RouteDrawer.Close>
            <Button type="submit" size="sm" disabled={isLoading}>
              Save
            </Button>
          </div>
        </RouteDrawer.Footer>
      </KeyboundForm>
    </RouteDrawer.Form>
  )
}

type VariantSelectionTableProps = {
  productId: string
  imageUrl: string
  value: string[]
  onChange: (value: string[]) => void
}

/**
 * Lives in its own component because `form.Field`'s children is a plain function call — hooks
 * cannot run inside it, and the table definition is a hook.
 */
function VariantSelectionTable({ productId, imageUrl, value, onChange }: VariantSelectionTableProps) {
  const table = useImageVariantsTable(productId, imageUrl, value, onChange)

  return <DataTable use={table} className="min-h-0 flex-1 rounded-none border-0" />
}
