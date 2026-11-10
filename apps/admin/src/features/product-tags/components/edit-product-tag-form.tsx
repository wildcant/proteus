import { useLingui } from '@lingui/react/macro'
import { AdminUpdateProductTag } from '@proteus/http-schemas/admin'
import type { AdminProductTag } from '#/api/generated/model'
import { EditValueForm } from '#/components/value-entity/edit-value-form'
import { useUpdateProductTag } from '#/features/product-tags/api/product-tags'

export function EditProductTagForm({ tag }: { tag: AdminProductTag }) {
  const { t } = useLingui()
  const { mutateAsync: updateTag } = useUpdateProductTag(tag.id)

  return <EditValueForm heading={t`Edit Tag`} value={tag.value} schema={AdminUpdateProductTag} save={updateTag} />
}
