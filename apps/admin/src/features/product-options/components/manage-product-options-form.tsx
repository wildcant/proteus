import { Plural, Trans } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteDrawer, useRouteModal } from '@proteus/ui'
import { useMemo } from 'react'
import type { AdminProductScopedOption } from '#/api/generated/model'
import { useProductOptions, useProductOptionsForProduct } from '#/features/product-options/api/product-options'
import { OptionValueSelector } from '#/features/product-options/components/option-value-selector'
import { useManageProductOptionsForm } from '#/features/product-options/hooks/use-manage-product-options-form'
import {
  describeOptionChange,
  type OptionChangeConsequences,
} from '#/features/product-options/utils/option-change-consequences'
import { useUiCopy } from '#/hooks/use-ui-copy'

function buildDefaultValues(currentOptions: AdminProductScopedOption[]) {
  return {
    options: currentOptions.map((option) => ({
      optionId: option.id,
      valueIds: option.values.map((value) => value.id),
    })),
  }
}

export function ManageProductOptionsForm({ productId }: { productId: string }) {
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()
  const { data: currentData } = useProductOptionsForProduct(productId)
  const { data: allData } = useProductOptions()

  const currentOptions = currentData?.productOptions ?? []
  const allOptions = allData?.productOptions ?? []

  const defaultValues = useMemo(() => buildDefaultValues(currentOptions), [currentOptions])

  const { form } = useManageProductOptionsForm({
    productId,
    defaultValues,
    params: { onSuccess: () => handleSuccess() },
  })

  return (
    <RouteDrawer.Form form={form} copy={unsavedChanges}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteDrawer.Header closeLabel={closeLabel}>
            <RouteDrawer.Title>
              <Trans>Manage Product Options</Trans>
            </RouteDrawer.Title>
          </RouteDrawer.Header>
          <RouteDrawer.Body className="space-y-6 p-6">
            <form.Field name="options">
              {(field) => (
                <OptionValueSelector allOptions={allOptions} value={field.state.value} onChange={field.handleChange} />
              )}
            </form.Field>

            {/* The variants follow the options, so what that costs is shown while it is still a
                choice rather than reported once it has happened. */}
            <form.Subscribe selector={(state) => state.values.options}>
              {(next) => <ConsequenceNotice consequences={describeOptionChange(currentOptions, next)} />}
            </form.Subscribe>
          </RouteDrawer.Body>
          <RouteDrawer.Footer>
            <RouteDrawer.Close render={<Button variant="secondary" size="sm" />}>
              <Trans>Cancel</Trans>
            </RouteDrawer.Close>
            <form.SubmitButton size="sm">
              <Trans>Save</Trans>
            </form.SubmitButton>
          </RouteDrawer.Footer>
        </form.AppForm>
      </KeyboundForm>
    </RouteDrawer.Form>
  )
}

function ConsequenceNotice({ consequences }: { consequences: OptionChangeConsequences }) {
  if (!consequences.isDestructive) return null

  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
      <h3 className="font-medium text-destructive text-sm">
        <Trans>Saving will delete variants</Trans>
      </h3>
      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-muted-foreground text-sm">
        {consequences.droppedValues.map(({ label, variantCount }) => (
          <li key={label}>
            <Trans>
              Removing <span className="font-medium">{label}</span> deletes{' '}
              <Plural value={variantCount} one="# variant" other="# variants" />.
            </Trans>
          </li>
        ))}
        {consequences.droppedOptions.map((title) => (
          <li key={title}>
            <Trans>
              Removing <span className="font-medium">{title}</span> merges variants that differ only by it. Those left
              standing for the same combination are deleted.
            </Trans>
          </li>
        ))}
      </ul>
    </div>
  )
}
