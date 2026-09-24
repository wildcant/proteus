import { Trans, useLingui } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteFocusModal, toast, useRouteModal } from '@proteus/ui'
import { ProgressTabs } from '#/components/progress-tabs'
import { useUiCopy } from '#/hooks/use-ui-copy'
import { useCreateProductForm } from '../../hooks/use-create-product-form'
import { Tab } from './constants'
import { ProductCreateAttributesForm } from './product-create-attributes-form'
import { ProductCreateDetailsForm } from './product-create-details-form'
import { ProductCreateOrganizeForm } from './product-create-organize-form'
import { ProductCreateVariantsForm } from './product-create-variants-form'
import { useProgressCreateProductForm } from './use-progress-create-product-form'

export function CreateProductForm() {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()
  const { form } = useCreateProductForm({
    onSuccess: (data) => {
      toast.add({ type: 'success', title: t`Product created successfully` })
      handleSuccess(`../${data.product.id}`)
    },
  })

  const { tab, tabState, groupRefs, isLastTab, handleTabChange, handleContinue, handleSave, handleKeyDown } =
    useProgressCreateProductForm(form)

  return (
    <RouteFocusModal.Form form={form} copy={unsavedChanges}>
      <KeyboundForm
        onSubmit={() => handleSave('publish')}
        onKeyDown={handleKeyDown}
        className="flex min-h-0 flex-1 flex-col"
      >
        <ProgressTabs value={tab} onValueChange={handleTabChange} className="min-h-0 flex-1">
          <RouteFocusModal.Header className="py-0 pr-0" closeLabel={closeLabel}>
            <RouteFocusModal.Title className="sr-only">
              <Trans>Create Product</Trans>
            </RouteFocusModal.Title>
            <ProgressTabs.List>
              <ProgressTabs.Trigger value={Tab.DETAILS} status={tabState[Tab.DETAILS]}>
                <Trans>Details</Trans>
              </ProgressTabs.Trigger>
              <ProgressTabs.Trigger value={Tab.ORGANIZE} status={tabState[Tab.ORGANIZE]}>
                <Trans>Organize</Trans>
              </ProgressTabs.Trigger>
              <ProgressTabs.Trigger value={Tab.ATTRIBUTES} status={tabState[Tab.ATTRIBUTES]}>
                <Trans>Attributes</Trans>
              </ProgressTabs.Trigger>
              <ProgressTabs.Trigger value={Tab.VARIANTS} status={tabState[Tab.VARIANTS]}>
                <Trans>Variants</Trans>
              </ProgressTabs.Trigger>
            </ProgressTabs.List>
          </RouteFocusModal.Header>

          <RouteFocusModal.Body>
            <ProgressTabs.Content value={Tab.DETAILS} keepMounted className="mx-auto max-w-180 px-6 py-16">
              <ProductCreateDetailsForm form={form} groupRefs={groupRefs} />
            </ProgressTabs.Content>
            <ProgressTabs.Content value={Tab.ORGANIZE} keepMounted className="mx-auto max-w-180 px-6 py-16">
              <ProductCreateOrganizeForm form={form} groupRefs={groupRefs} />
            </ProgressTabs.Content>
            <ProgressTabs.Content value={Tab.ATTRIBUTES} keepMounted className="mx-auto max-w-180 px-6 py-16">
              <ProductCreateAttributesForm form={form} groupRefs={groupRefs} />
            </ProgressTabs.Content>
            <ProgressTabs.Content value={Tab.VARIANTS} keepMounted>
              <ProductCreateVariantsForm form={form} groupRefs={groupRefs} />
            </ProgressTabs.Content>
          </RouteFocusModal.Body>
        </ProgressTabs>

        <RouteFocusModal.Footer>
          <RouteFocusModal.Close render={<Button variant="secondary" size="sm" />}>
            <Trans>Cancel</Trans>
          </RouteFocusModal.Close>
          {/* Not `form.SubmitButton`: two of these save, with different intents, and the third only
              moves a tab — none of them can be the form's one submit. They read the same
              `isSubmitting` it does, which spans the media upload as well as the create because
              the hook awaits both inside `onSubmit`. */}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <>
                <Button type="button" size="sm" disabled={isSubmitting} onClick={() => handleSave('draft')}>
                  <Trans>Save as Draft</Trans>
                </Button>
                {isLastTab ? (
                  <Button type="button" size="sm" disabled={isSubmitting} onClick={() => handleSave('publish')}>
                    <Trans>Publish</Trans>
                  </Button>
                ) : (
                  <Button type="button" size="sm" onClick={handleContinue}>
                    <Trans>Continue</Trans>
                  </Button>
                )}
              </>
            )}
          </form.Subscribe>
        </RouteFocusModal.Footer>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}
