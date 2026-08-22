import { Button } from '@proteus/ui'
import { useCallback, useMemo } from 'react'
import type { AdminProductOption, AdminProductVariant } from '#/api/generated/model'
import { KeyboundForm } from '#/components/modals/keybound-form'
import { RouteDrawer } from '#/components/modals/route-drawer/route-drawer'
import { useRouteModal } from '#/components/modals/route-modal-provider/use-route-modal'
import { MultiSelectCombobox } from '#/components/multi-select-combobox'
import { useProductOptions, useProductOptionsForProduct } from '#/features/product-options/api/product-options'
import { useManageProductOptionsForm } from '#/features/product-options/hooks/use-manage-product-options-form'
import { useProductVariants } from '#/features/products/api/product-variants'

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

  // 100 is the API's pagination ceiling; the notice below is advisory, the backend still enforces.
  const { data: variantsData } = useProductVariants(productId, { limit: 100 })

  const currentOptions = currentData?.productOptions ?? []
  const allOptions = allData?.productOptions ?? []
  const variants = variantsData?.variants ?? []

  const defaultValues = useMemo(() => buildDefaultValues(currentOptions), [currentOptions])

  const { form } = useManageProductOptionsForm({
    productId,
    defaultValues,
    params: { onSuccess: () => handleSuccess() },
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
              <>
                <OptionSelector allOptions={allOptions} value={field.state.value} onChange={field.handleChange} />
                <InUseNotice allOptions={allOptions} variants={variants} value={field.state.value} />
              </>
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

type InUseNoticeProps = {
  allOptions: AdminProductOption[]
  variants: AdminProductVariant[]
  value: OptionEntry[]
}

/**
 * The backend refuses to unlink an option or value some variant still carries. Showing what would
 * break — computed from the variants' own tuples — turns that rejection into something the
 * shopkeeper sees before pressing Save rather than only after.
 */
function InUseNotice({ allOptions, variants, value }: InUseNoticeProps) {
  const blocked = useMemo(() => {
    const keptOptionIds = new Set(value.map((entry) => entry.optionId))
    // An option kept with no values selected offers all of them, so nothing is dropped there.
    const offersEveryValue = new Set(value.filter((entry) => entry.valueIds.length === 0).map((e) => e.optionId))
    const keptValueIds = new Set(value.flatMap((entry) => entry.valueIds))

    const labels = new Map(allOptions.flatMap((o) => o.values.map((v) => [v.id, `${o.title}: ${v.value}`])))
    const optionTitles = new Map(allOptions.map((option) => [option.id, option.title]))

    const droppedOptions = new Set<string>()
    const droppedValues = new Set<string>()

    for (const variant of variants) {
      for (const [optionId, valueId] of Object.entries(variant.optionValues)) {
        if (!keptOptionIds.has(optionId)) {
          droppedOptions.add(optionTitles.get(optionId) ?? optionId)
          continue
        }
        if (!offersEveryValue.has(optionId) && !keptValueIds.has(valueId)) {
          droppedValues.add(labels.get(valueId) ?? valueId)
        }
      }
    }

    return [...droppedOptions, ...droppedValues]
  }, [allOptions, variants, value])

  if (blocked.length === 0) return null

  return (
    <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive text-sm">
      Still used by existing variants: {blocked.join(', ')}. Saving will be rejected until those variants are updated.
    </p>
  )
}

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
    return <p className="text-muted-foreground text-sm">No product options available. Create one first.</p>
  }

  return (
    <>
      <div>
        <h2 className="font-medium text-sm">Product Options</h2>
        <p className="mb-3 text-muted-foreground text-sm">Select which options should be associated to this product.</p>
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
          <h2 className="font-medium text-sm">Values</h2>
          <p className="mb-3 text-muted-foreground text-sm">Select which values to use for each option.</p>
          <div className="space-y-4">
            {selectedOptions.map((option) => {
              const valueItems = option.values.map((v) => ({ id: v.id, label: v.value }))
              const entry = value.find((e) => e.optionId === option.id)
              return (
                <div key={option.id}>
                  <h3 className="mb-2 font-medium text-muted-foreground text-sm">{option.title}</h3>
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
