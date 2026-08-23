import { Button, toast } from '@proteus/ui'
import { KeyboundForm } from '#/components/modals/keybound-form'
import { RouteFocusModal } from '#/components/modals/route-focus-modal/route-focus-modal'
import { useRouteModal } from '#/components/modals/route-modal-provider/use-route-modal'
import { ProgressTabs } from '#/components/progress-tabs'
import { useCreateProductForm } from '../../hooks/use-create-product-form'
import { Tab } from './constants'
import { ProductCreateAttributesForm } from './product-create-attributes-form'
import { ProductCreateDetailsForm } from './product-create-details-form'
import { ProductCreateOrganizeForm } from './product-create-organize-form'
import { ProductCreateVariantsForm } from './product-create-variants-form'
import { useProgressCreateProductForm } from './use-progress-create-product-form'

export function CreateProductForm() {
  const { handleSuccess } = useRouteModal()
  const { form } = useCreateProductForm({
    onSuccess: (data) => {
      toast.add({ type: 'success', title: 'Product created successfully' })
      handleSuccess(`../${data.product.id}`)
    },
  })

  const { tab, tabState, groupRefs, isLastTab, handleTabChange, handleContinue, handleSave, handleKeyDown } =
    useProgressCreateProductForm(form)

  return (
    <RouteFocusModal.Form form={form}>
      <KeyboundForm
        onSubmit={() => handleSave('publish')}
        onKeyDown={handleKeyDown}
        className="flex min-h-0 flex-1 flex-col"
      >
        <ProgressTabs value={tab} onValueChange={handleTabChange} className="min-h-0 flex-1">
          <RouteFocusModal.Header className="py-0 pr-0">
            <RouteFocusModal.Title className="sr-only">Create Product</RouteFocusModal.Title>
            <ProgressTabs.List>
              <ProgressTabs.Trigger value={Tab.DETAILS} status={tabState[Tab.DETAILS]}>
                Details
              </ProgressTabs.Trigger>
              <ProgressTabs.Trigger value={Tab.ORGANIZE} status={tabState[Tab.ORGANIZE]}>
                Organize
              </ProgressTabs.Trigger>
              <ProgressTabs.Trigger value={Tab.ATTRIBUTES} status={tabState[Tab.ATTRIBUTES]}>
                Attributes
              </ProgressTabs.Trigger>
              <ProgressTabs.Trigger value={Tab.VARIANTS} status={tabState[Tab.VARIANTS]}>
                Variants
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
          <RouteFocusModal.Close render={<Button variant="secondary" size="sm" />}>Cancel</RouteFocusModal.Close>
          <Button type="button" size="sm" onClick={() => handleSave('draft')}>
            Save as Draft
          </Button>
          {isLastTab ? (
            <Button type="button" size="sm" onClick={() => handleSave('publish')}>
              Publish
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={handleContinue}>
              Continue
            </Button>
          )}
        </RouteFocusModal.Footer>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}
