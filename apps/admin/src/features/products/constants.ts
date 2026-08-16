import type { AdminProductStatus } from '#/api/generated/model'

export const productStatusBadgeVariants: Record<
  AdminProductStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  published: 'default',
  draft: 'secondary',
  proposed: 'outline',
  rejected: 'destructive',
}
