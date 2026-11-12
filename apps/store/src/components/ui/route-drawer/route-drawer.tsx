import { cn, RouteModalProvider } from '@proteus/ui-core'
import { type AnyFormApi, useSelector } from '@tanstack/react-form'
import { useBlocker, useNavigate } from '@tanstack/react-router'
import { XIcon } from 'lucide-react'
import { type CSSProperties, type HTMLAttributes, type PropsWithChildren, useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog/alert-dialog'
import {
  Drawer,
  DrawerClose,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from '#/components/ui/drawer/drawer'
import {
  routeDrawer,
  routeDrawerActions,
  routeDrawerBody,
  routeDrawerClose,
  routeDrawerCloseIcon,
  routeDrawerFooter,
  routeDrawerHeader,
  routeDrawerKbd,
  routeDrawerKey,
  routeDrawerTitle,
  routeDrawerTitleGroup,
} from '#/components/ui/route-drawer/route-drawer.variants'

type RouteDrawerProps = PropsWithChildren<{
  /** Where closing goes: a path (replacing the drawer's entry) or a history delta. */
  prev?: string | number
  className?: string
  /**
   * Merged onto the panel's inline style. `--drawer-content-width` and `--drawer-inset` go here,
   * not in `className`: the popup sets both behind a `data-[swipe-axis=x]:` selector, which
   * outranks a plain utility.
   */
  style?: CSSProperties
}>

/**
 * A drawer off the right edge whose open state is the route: it opens on mount, and closing it
 * navigates to `prev`. Full width on the phone; the design's width from `sm` up.
 *
 * Compound API: `.Header`, `.Title`, `.Description`, `.Body`, `.Footer`, `.Close`, `.Form`
 * (unsaved-changes guard).
 */
export function RouteDrawer({ prev = '..', className, style, children }: RouteDrawerProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(true)
    return () => setOpen(false)
  }, [])

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setOpen(next)
      return
    }
    document.body.style.pointerEvents = 'auto'
    if (typeof prev === 'number') {
      window.history.go(prev)
      return
    }
    navigate({ to: prev, replace: true })
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange} swipeDirection="right">
      <RouteModalProvider prev={prev}>
        <DrawerPopup
          className={cn(routeDrawer(), className)}
          style={{ '--drawer-inset': '0px', '--drawer-content-width': '100%', ...style } as CSSProperties}
        >
          {children}
        </DrawerPopup>
      </RouteModalProvider>
    </Drawer>
  )
}

RouteDrawer.Header = ({
  className,
  children,
  closeLabel = 'Close',
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  /** Screen-reader label for the close button. */
  closeLabel?: string
}) => (
  <DrawerHeader className={cn(routeDrawerHeader(), className)} {...props}>
    <div className={routeDrawerTitleGroup()}>{children}</div>
    <div className={routeDrawerActions()}>
      <kbd className={cn(routeDrawerKbd(), routeDrawerKey())}>esc</kbd>
      <DrawerClose className={cn(routeDrawerClose(), 'shrink-0 cursor-pointer outline-none transition-all')}>
        <XIcon aria-hidden="true" className={routeDrawerCloseIcon()} />
        <span className="sr-only">{closeLabel}</span>
      </DrawerClose>
    </div>
  </DrawerHeader>
)

RouteDrawer.Body = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn(routeDrawerBody(), 'min-h-0', className)} {...props} />
)

RouteDrawer.Footer = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <DrawerFooter className={cn(routeDrawerFooter(), 'mt-auto', className)} {...props} />
)

RouteDrawer.Title = ({ className, ...props }: Parameters<typeof DrawerTitle>[0]) => (
  <DrawerTitle className={cn(routeDrawerTitle(), className)} {...props} />
)

RouteDrawer.Description = DrawerDescription
RouteDrawer.Close = DrawerClose

/** The unsaved-changes prompt's copy. The caller passes it translated. */
type UnsavedChangesCopy = {
  title: string
  description: string
  cancel: string
  confirm: string
}

type RouteDrawerFormProps = PropsWithChildren<{
  form: AnyFormApi
  blockSearchParams?: boolean
  copy: UnsavedChangesCopy
}>

/**
 * Blocks leaving while the form is dirty, with an alert dialog that only Cancel (stay) or Continue
 * (discard) dismisses. A successful save gets through: `useRouteModal().handleSuccess` marks the
 * history entry `isSubmitSuccessful` before navigating.
 */
function RouteDrawerForm({ form, blockSearchParams = false, copy, children }: RouteDrawerFormProps) {
  const isDirty = useSelector(form.store, (state) => state.isDirty)

  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => {
      const historyState = window.history.state as Record<string, unknown> | null
      if (historyState?.isSubmitSuccessful) {
        return false
      }

      const isPathChanged = current.pathname !== next.pathname
      const isSearchChanged = JSON.stringify(current.search) !== JSON.stringify(next.search)

      if (blockSearchParams) {
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
              <AlertDialogTitle>{copy.title}</AlertDialogTitle>
              <AlertDialogDescription>{copy.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => blocker.reset()}>{copy.cancel}</AlertDialogCancel>
              <AlertDialogAction variant="default" onClick={() => blocker.proceed()}>
                {copy.confirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}

RouteDrawer.Form = RouteDrawerForm
