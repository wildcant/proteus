import { Button, TagInput, toast } from '@proteus/ui'
import type { AdminProductOption } from '#/api/generated/model'
import { KeyboundForm } from '#/components/modals/keybound-form'
import { RouteFocusModal } from '#/components/modals/route-focus-modal/route-focus-modal'
import { useRouteModal } from '#/components/modals/route-modal-provider/use-route-modal'
import { useEditProductOptionForm } from '#/features/product-options/hooks/use-edit-product-option-form'

export function EditProductOptionForm({ option }: { option: AdminProductOption }) {
  const { handleSuccess } = useRouteModal()

  const { form } = useEditProductOptionForm(option, {
    onSuccess: () => handleSuccess(),
    onError: (error) => toast.add({ type: 'error', title: 'Failed to update option', description: error }),
  })

  return (
    <RouteFocusModal.Form form={form}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <RouteFocusModal.Header>
          <div className="flex items-center gap-x-2">
            <Button type="submit" size="sm">
              Save
            </Button>
          </div>
        </RouteFocusModal.Header>
        <RouteFocusModal.Body className="mx-auto flex w-full max-w-lg flex-col gap-y-8 py-16">
          <div>
            <h1 className="text-2xl font-semibold">Edit Option</h1>
            <p className="text-muted-foreground text-sm">Update option title and values.</p>
          </div>
          <form.AppField name="title">
            {(field) => <field.TextField label="Title" autoFocus placeholder="e.g. Color, Size" />}
          </form.AppField>
          <div>
            <h2 className="mb-2 text-sm font-medium">Values</h2>
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
        </RouteFocusModal.Body>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}
