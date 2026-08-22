import { Button, NativeSelect, NativeSelectOption } from '@proteus/ui'
import type { AdminProductOption, AdminProductVariant } from '#/api/generated/model'
import { KeyboundForm } from '#/components/modals/keybound-form'
import { RouteDrawer } from '#/components/modals/route-drawer/route-drawer'
import { useRouteModal } from '#/components/modals/route-modal-provider/use-route-modal'
import { useEditVariantForm } from '#/features/products/hooks/use-edit-variant-form'

type EditVariantFormProps = {
  productId: string
  variant: AdminProductVariant
  options: AdminProductOption[]
}

export function EditVariantForm({ productId, variant, options }: EditVariantFormProps) {
  const { handleSuccess } = useRouteModal()

  const { form } = useEditVariantForm({
    productId,
    variant,
    options,
    params: { onSuccess: () => handleSuccess() },
  })

  return (
    <RouteDrawer.Form form={form}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <RouteDrawer.Header>
          <RouteDrawer.Title>Edit Variant</RouteDrawer.Title>
        </RouteDrawer.Header>
        <RouteDrawer.Body className="space-y-4">
          <form.AppField name="title">
            {(field) => <field.TextField label="Title" autoFocus placeholder="Variant title" />}
          </form.AppField>
          <form.AppField name="material">
            {(field) => <field.TextField label="Material" placeholder="Optional" />}
          </form.AppField>

          {/* One select per option — the DB allows exactly one value per option per variant. */}
          {options.map((option) => (
            <form.Field key={option.id} name={`optionValues.${option.id}`}>
              {(field) => (
                <div>
                  <label htmlFor={`option-${option.id}`} className="mb-1.5 block font-medium text-sm">
                    {option.title}
                  </label>
                  <NativeSelect
                    id={`option-${option.id}`}
                    className="w-full"
                    value={field.state.value ?? ''}
                    onChange={(event) => field.handleChange(event.target.value)}
                  >
                    <NativeSelectOption value="">Select {option.title}</NativeSelectOption>
                    {option.values.map((value) => (
                      <NativeSelectOption key={value.id} value={value.id}>
                        {value.value}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              )}
            </form.Field>
          ))}

          <form.AppField name="sku">{(field) => <field.TextField label="SKU" placeholder="Optional" />}</form.AppField>
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
