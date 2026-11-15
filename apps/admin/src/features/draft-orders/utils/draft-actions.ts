import type { AdminDraftOrderStatus } from '#/api/generated/model'

export type DraftActions = {
  /** Contact, address, shipping and items. */
  canEdit: boolean
  canConvert: boolean
  canCancel: boolean
  canDelete: boolean
}

/**
 * What the admin may do to a draft, from its status and the admin's permission keys (`/me`'s
 * `allowedActions`). Only an open draft (status `draft`) changes; a canceled one can still be
 * deleted, so a mistake leaves the list.
 */
export function draftActions(status: AdminDraftOrderStatus, allowedActions: readonly string[]): DraftActions {
  const isOpen = status === 'draft'
  const can = (key: string) => allowedActions.includes(key)

  return {
    canEdit: isOpen && can('order.edit'),
    canConvert: isOpen && can('order.complete'),
    canCancel: isOpen && can('order.cancel'),
    canDelete: can('order.edit'),
  }
}
