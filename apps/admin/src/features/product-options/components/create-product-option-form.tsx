import { Button, KeyboundForm, RouteFocusModal, TagInput, useRouteModal } from '@proteus/ui'
import { useCreateProductOptionForm } from '#/features/product-options/hooks/use-create-product-option-form'

export function CreateProductOptionForm() {
  const { handleSuccess } = useRouteModal()

  const { form } = useCreateProductOptionForm({
    onSuccess: () => handleSuccess(),
  })

  return (
    <RouteFocusModal.Form form={form}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <RouteFocusModal.Header />
        <RouteFocusModal.Body>
          <div className="mx-auto flex w-full max-w-lg flex-col gap-y-8 py-16">
            <div>
              <h1 className="font-semibold text-2xl">Create Option</h1>
              <p className="text-muted-foreground text-sm">Create a new product option with values.</p>
            </div>
            <form.AppField name="title">
              {(field) => <field.TextField label="Title" autoFocus placeholder="e.g. Color, Size" />}
            </form.AppField>
            <div>
              <h2 className="mb-2 font-medium text-sm">Values</h2>
              <form.Field name="values">
                {(field) => (
                  <TagInput
                    value={(field.state.value ?? []).map((v) => ({ id: v.value, label: v.value }))}
                    onChange={(items) => field.handleChange(items.map((item, rank) => ({ value: item.label, rank })))}
                    placeholder="Type a value and press Enter"
                  />
                )}
              </form.Field>
            </div>
          </div>
        </RouteFocusModal.Body>
        <RouteFocusModal.Footer>
          <Button type="submit" size="sm">
            Save
          </Button>
        </RouteFocusModal.Footer>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}
