import type { AnyFormGroupApi } from '@tanstack/form-core'

export const Tab = {
  DETAILS: 'details',
  ORGANIZE: 'organize',
  ATTRIBUTES: 'attributes',
  VARIANTS: 'variants',
} as const
export type Tab = (typeof Tab)[keyof typeof Tab]
export const TABS = [Tab.DETAILS, Tab.ORGANIZE, Tab.ATTRIBUTES, Tab.VARIANTS] as const
export const LAST_TAB = Tab.VARIANTS

export type SubmitIntent = { intent: 'draft' | 'publish' }
export type GroupRefs = React.RefObject<Partial<Record<Tab, AnyFormGroupApi>>>
