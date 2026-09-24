import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import type { AdminProductStatus } from '#/api/generated/model'

type StatusColor = 'green' | 'red' | 'blue' | 'orange' | 'grey' | 'purple'

export const productStatusColors: Record<AdminProductStatus, StatusColor> = {
  published: 'green',
  draft: 'grey',
  proposed: 'orange',
  rejected: 'red',
}

/** The badge text for each status. Lowercase, like the value it replaces: the badge capitalises it. */
export const productStatusLabels: Record<AdminProductStatus, MessageDescriptor> = {
  published: msg`published`,
  draft: msg`draft`,
  proposed: msg`proposed`,
  rejected: msg`rejected`,
}
