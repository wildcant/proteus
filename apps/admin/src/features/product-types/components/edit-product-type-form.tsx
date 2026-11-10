import { useLingui } from '@lingui/react/macro'
import { AdminUpdateProductType } from '@proteus/http-schemas/admin'
import type { AdminProductType } from '#/api/generated/model'
import { EditValueForm } from '#/components/value-entity/edit-value-form'
import { useUpdateProductType } from '#/features/product-types/api/product-types'

export function EditProductTypeForm({ type }: { type: AdminProductType }) {
  const { t } = useLingui()
  const { mutateAsync: updateType } = useUpdateProductType(type.id)

  return <EditValueForm heading={t`Edit Type`} value={type.value} schema={AdminUpdateProductType} save={updateType} />
}
