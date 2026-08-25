import { Button, KeyboundForm, RouteFocusModal, toast, useRouteModal } from '@proteus/ui'
import type { AdminProductResponseProduct } from '#/api/generated/model'
import { ProductMediaGrid } from '#/features/products/components/media/product-media-grid'
import { UploadMediaFormItem } from '#/features/products/components/media/upload-media-form-item'
import { useEditProductMediaForm } from '#/features/products/hooks/use-edit-product-media-form'

export function EditProductMediaForm({ product }: { product: AdminProductResponseProduct }) {
  const { handleSuccess } = useRouteModal()

  const { form, isLoading } = useEditProductMediaForm(product, {
    onSuccess: () => {
      toast.add({ type: 'success', title: 'Media updated successfully' })
      handleSuccess()
    },
  })

  return (
    <RouteFocusModal.Form form={form}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        <RouteFocusModal.Header></RouteFocusModal.Header>
        <RouteFocusModal.Body className="flex flex-col overflow-hidden">
          <div className="flex size-full flex-col-reverse lg:grid lg:grid-cols-[1fr_440px]">
            <div className="size-full overflow-auto bg-muted/40">
              <form.Field name="media">
                {(field) => <ProductMediaGrid media={field.state.value} onChange={field.handleChange} />}
              </form.Field>
            </div>
            <div className="overflow-auto border-b px-6 py-4 lg:border-b-0 lg:border-l">
              <form.AppField name="media">{() => <UploadMediaFormItem />}</form.AppField>
            </div>
          </div>
        </RouteFocusModal.Body>
        <RouteFocusModal.Footer>
          <RouteFocusModal.Close render={<Button variant="secondary" size="sm" />}>Cancel</RouteFocusModal.Close>
          <Button type="submit" size="sm" disabled={isLoading}>
            Save
          </Button>
        </RouteFocusModal.Footer>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}
