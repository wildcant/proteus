import type { AnyFormApi } from '@tanstack/form-core'
import { useSelector } from '@tanstack/react-form'
import { useBlocker } from '@tanstack/react-router'
import type { PropsWithChildren } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog.tsx'

type RouteModalFormProps = PropsWithChildren<{
  form: AnyFormApi
  blockSearchParams?: boolean
}>

/**
 * Unsaved-changes guard for route-driven modals.
 *
 * Wraps a TanStack Form instance and uses TanStack Router's `useBlocker` to
 * prevent navigation when the form is dirty. Shows an AlertDialog (which
 * cannot be dismissed via Escape or overlay click) forcing the user to
 * explicitly choose Cancel (stay) or Continue (discard changes).
 *
 * The blocker is bypassed when `isSubmitSuccessful` is set in history state
 * (done by `RouteModalProvider.handleSuccess`), so successful saves navigate
 * without triggering the prompt.
 *
 * Used as `RouteFocusModal.Form` / `RouteDrawer.Form` in the compound API.
 */
export const RouteModalForm = ({ form, blockSearchParams: blockSearch = false, children }: RouteModalFormProps) => {
  const isDirty = useSelector(form.store, (s) => s.isDirty)

  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => {
      const historyState = window.history.state as Record<string, unknown> | null
      if (historyState?.isSubmitSuccessful) {
        return false
      }

      const isPathChanged = current.pathname !== next.pathname
      const isSearchChanged = JSON.stringify(current.search) !== JSON.stringify(next.search)

      if (blockSearch) {
        return isDirty && (isPathChanged || isSearchChanged)
      }

      return isDirty && isPathChanged
    },
    withResolver: true,
    enableBeforeUnload: () => isDirty,
  })

  return (
    <>
      {children}

      {blocker.status === 'blocked' && (
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>You have unsaved changes</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to leave? Your unsaved changes will be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => blocker.reset()}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => blocker.proceed()}>Continue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}
