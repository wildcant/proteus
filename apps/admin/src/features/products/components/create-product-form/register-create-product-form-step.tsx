import type { AnyFormGroupApi } from '@tanstack/form-core'
import { useEffect } from 'react'
import type { GroupRefs, Tab } from './constants'

/**
 * Registers a FormGroup API in the shared ref map, so the parent can validate any step.
 *
 * A component rather than a hook, and it renders nothing: the group API only exists inside
 * `<form.FormGroup>`'s render prop, and that prop is a callback TanStack Form runs inside its own
 * `useMemo` — not a component. A hook called there is a rules-of-hooks violation that React 19
 * reports on every render, and its effect belongs to whichever component happens to be rendering.
 * Mounted as an element, the effect is this component's own and unmounts with the step.
 */
export function RegisterCreateProductFormStep({
  groupRefs,
  tab,
  formGroup,
}: {
  groupRefs: GroupRefs
  tab: Tab
  formGroup: AnyFormGroupApi
}) {
  useEffect(() => {
    groupRefs.current[tab] = formGroup
    return () => {
      delete groupRefs.current[tab]
    }
  }, [groupRefs, tab, formGroup])

  return null
}
