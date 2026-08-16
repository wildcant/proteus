import { Button, toast } from '@proteus/ui'
import { useCallback, useMemo } from 'react'
import type { AdminProductOption } from '#/api/generated/model'
import { KeyboundForm } from '#/components/modals/keybound-form'
import { RouteDrawer } from '#/components/modals/route-drawer/route-drawer'
import { useRouteModal } from '#/components/modals/route-modal-provider/use-route-modal'
import { MultiSelectCombobox } from '#/components/multi-select-combobox'
import { useProductOptions, useProductOptionsForProduct } from '#/features/product-options/api/product-options'
import { useManageProductOptionsForm } from '#/features/product-options/hooks/use-manage-product-options-form'

function buildDefaultValues(currentOptions: AdminProductOption[]) {
  return {
    options: currentOptions.map((option) => ({
      optionId: option.id,
      valueIds: option.values.map((value) => value.id),
    })),
  }
}

export function ManageProductOptionsForm({ productId }: { productId: string }) {
  const { handleSuccess } = useRouteModal()
  const { data: currentData } = useProductOptionsForProduct(productId)
  const { data: allData } = useProductOptions()

  const currentOptions = currentData?.productOptions ?? []
  const allOptions = allData?.productOptions ?? []

  const defaultValues = useMemo(() => buildDefaultValues(currentOptions), [currentOptions])

  const { form } = useManageProductOptionsForm({
    productId,
    defaultValues,
    params: {
      onSuccess: () => handleSuccess(),
      onError: (error) => toast.add({ type: 'error', title: 'Failed to update options', description: error }),
    },
  })

  return (
    <RouteDrawer.Form form={form}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <RouteDrawer.Header>
          <RouteDrawer.Title>Manage Product Options</RouteDrawer.Title>
        </RouteDrawer.Header>
        <RouteDrawer.Body className="space-y-6 p-6">
          <form.Field name="options">
            {(field) => (
              <OptionSelector allOptions={allOptions} value={field.state.value} onChange={field.handleChange} />
            )}
          </form.Field>
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

type OptionEntry = { optionId: string; valueIds: string[] }

type OptionSelectorProps = {
  allOptions: AdminProductOption[]
  value: OptionEntry[]
  onChange: (value: OptionEntry[]) => void
}

function OptionSelector({ allOptions, value, onChange }: OptionSelectorProps) {
  const optionMap = useMemo(() => new Map(allOptions.map((option) => [option.id, option])), [allOptions])

  const selectedOptionIds = useMemo(() => value.map((entry) => entry.optionId), [value])

  const optionItems = useMemo(() => allOptions.map((option) => ({ id: option.id, label: option.title })), [allOptions])

  const handleOptionsChange = useCallback(
    (selectedIds: string[]) => {
      const next: OptionEntry[] = selectedIds.map((optionId) => {
        const existing = value.find((entry) => entry.optionId === optionId)
        if (existing) return existing
        const option = optionMap.get(optionId)
        // Select all values by default when an option is first added
        return { optionId, valueIds: option?.values.map((v) => v.id) ?? [] }
      })
      onChange(next)
    },
    [value, onChange, optionMap],
  )

  const handleValuesChange = useCallback(
    (optionId: string, valueIds: string[]) => {
      if (valueIds.length === 0) {
        onChange(value.filter((entry) => entry.optionId !== optionId))
        return
      }
      onChange(value.map((entry) => (entry.optionId === optionId ? { ...entry, valueIds } : entry)))
    },
    [value, onChange],
  )

  const selectedOptions = value.map((entry) => optionMap.get(entry.optionId)).filter(Boolean) as AdminProductOption[]

  if (allOptions.length === 0) {
    return <p className="text-sm text-muted-foreground">No product options available. Create one first.</p>
  }

  return (
    <>
      <div>
        <h2 className="text-sm font-medium">Product Options</h2>
        <p className="mb-3 text-sm text-muted-foreground">Select which options should be associated to this product.</p>
        <MultiSelectCombobox
          items={optionItems}
          value={selectedOptionIds}
          onValueChange={handleOptionsChange}
          placeholder="Search options..."
          emptyMessage="No options found."
        />
      </div>

      {selectedOptions.length > 0 && (
        <div>
          <h2 className="text-sm font-medium">Values</h2>
          <p className="mb-3 text-sm text-muted-foreground">Select which values to use for each option.</p>
          <div className="space-y-4">
            {selectedOptions.map((option) => {
              const valueItems = option.values.map((v) => ({ id: v.id, label: v.value }))
              const entry = value.find((e) => e.optionId === option.id)
              return (
                <div key={option.id}>
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">{option.title}</h3>
                  <MultiSelectCombobox
                    items={valueItems}
                    value={entry?.valueIds ?? []}
                    onValueChange={(valueIds) => handleValuesChange(option.id, valueIds)}
                    placeholder="Search values..."
                    emptyMessage="No values found."
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
