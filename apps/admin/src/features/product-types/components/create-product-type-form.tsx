import { useLingui } from '@lingui/react/macro'
import { AdminCreateProductType } from '@proteus/http-schemas/admin'
import { CreateValueForm } from '#/components/value-entity/create-value-form'
import { useCreateProductType } from '#/features/product-types/api/product-types'

export function CreateProductTypeForm() {
  const { t } = useLingui()
  const { mutateAsync: createType } = useCreateProductType()

  return (
    <CreateValueForm
      heading={t`Create Type`}
      description={t`Name what a product is. A product has one type.`}
      placeholder={t`e.g. T-shirt`}
      schema={AdminCreateProductType}
      save={createType}
    />
  )
}
