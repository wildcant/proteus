import { useLingui } from '@lingui/react/macro'
import type { UnsavedChangesCopy } from '@proteus/ui'

/**
 * The copy `@proteus/ui` components take as props, in the admin's language. The components default
 * to English so the package never depends on Lingui; every admin call site passes these instead.
 */
export function useUiCopy(): { closeLabel: string; cancel: string; unsavedChanges: UnsavedChangesCopy } {
  const { t } = useLingui()
  return {
    closeLabel: t`Close`,
    cancel: t`Cancel`,
    unsavedChanges: {
      title: t`You have unsaved changes`,
      description: t`Are you sure you want to leave? Your unsaved changes will be lost.`,
      cancel: t`Cancel`,
      confirm: t`Continue`,
    },
  }
}
