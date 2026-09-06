import type { AdminProductStatus } from '#/api/generated/model'

type StatusColor = 'green' | 'red' | 'blue' | 'orange' | 'grey' | 'purple'

export const productStatusColors: Record<AdminProductStatus, StatusColor> = {
  published: 'green',
  draft: 'grey',
  proposed: 'orange',
  rejected: 'red',
}
