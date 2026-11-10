import { useLingui } from '@lingui/react/macro'
import { AdminCreateProductTag } from '@proteus/http-schemas/admin'
import { CreateValueForm } from '#/components/value-entity/create-value-form'
import { useCreateProductTag } from '#/features/product-tags/api/product-tags'

export function CreateProductTagForm() {
  const { t } = useLingui()
  const { mutateAsync: createTag } = useCreateProductTag()

  return (
    <CreateValueForm
      heading={t`Create Tag`}
      description={t`A keyword shoppers can filter products by. A product can have several.`}
      placeholder={t`e.g. organic-cotton`}
      schema={AdminCreateProductTag}
      save={createTag}
    />
  )
}
