import { Button, KeyboundForm, RouteDrawer, useRouteModal } from '@proteus/ui'
import type { AdminProduct } from '#/api/generated/model'
import { useEditProductForm } from '#/features/products/hooks/use-edit-product-form'

export function EditProductForm({ product }: { product: AdminProduct }) {
  const { handleSuccess } = useRouteModal()

  const { form } = useEditProductForm(product, {
    onSuccess: () => handleSuccess(),
  })

  return (
    <RouteDrawer.Form form={form}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <RouteDrawer.Header>
          <RouteDrawer.Title>Edit Product</RouteDrawer.Title>
        </RouteDrawer.Header>
        <RouteDrawer.Body>
          <form.AppField name="title">
            {(field) => <field.TextField label="Title" autoFocus placeholder="Product title" />}
          </form.AppField>
        </RouteDrawer.Body>
        <RouteDrawer.Footer>
          <RouteDrawer.Close render={<Button variant="secondary" size="sm" />}>Cancel</RouteDrawer.Close>
          <Button type="submit" size="sm">
            Save
          </Button>
        </RouteDrawer.Footer>
      </KeyboundForm>
    </RouteDrawer.Form>
  )
}
