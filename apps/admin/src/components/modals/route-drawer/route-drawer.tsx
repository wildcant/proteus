import {
  Button,
  cn,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@proteus/ui'
import { useNavigate } from '@tanstack/react-router'
import { XIcon } from 'lucide-react'
import { type PropsWithChildren, useEffect, useState } from 'react'
import { RouteModalForm } from '../route-modal-form/route-modal-form'
import { RouteModalProvider } from '../route-modal-provider/route-provider'

type RouteDrawerProps = PropsWithChildren<{
  prev?: string | number
}>

/**
 * Right-side route-driven drawer for edit flows.
 *
 * Same route-driven pattern as `RouteFocusModal` but slides in from the right
 * (`swipeDirection="right"`). Used for simpler edit forms where a side panel
 * is more appropriate than a full-screen takeover.
 *
 * Compound API: `.Header`, `.Title`, `.Description`, `.Body`, `.Footer`,
 * `.Close`, `.Form` (unsaved-changes guard).
 */
export function RouteDrawer({ prev = '..', children }: RouteDrawerProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(true)
    return () => setOpen(false)
  }, [])

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      document.body.style.pointerEvents = 'auto'
      if (typeof prev === 'number') {
        window.history.go(prev)
      } else {
        navigate({ to: prev, replace: true })
      }
      return
    }
    setOpen(open)
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange} swipeDirection="right">
      <RouteModalProvider prev={prev}>
        <DrawerContent
          className="shadow-lg data-[swipe-direction=right]:rounded-lg data-[swipe-direction=right]:border"
          style={{ '--drawer-inset': '8px', '--drawer-content-width': '560px' } as React.CSSProperties}
        >
          {children}
        </DrawerContent>
      </RouteModalProvider>
    </Drawer>
  )
}

RouteDrawer.Header = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <DrawerHeader
    className={cn('flex shrink-0 flex-row items-start justify-between gap-x-4 border-b px-6 py-4', className)}
    {...props}
  >
    <div className="flex flex-col gap-y-1">{children}</div>
    <div className="flex items-center gap-x-2">
      <kbd className="inline-flex h-5 items-center rounded border px-1 font-mono text-[11px] text-muted-foreground">
        esc
      </kbd>
      <DrawerClose render={<Button variant="ghost" size="icon-sm" />}>
        <XIcon className="size-4" />
        <span className="sr-only">Close</span>
      </DrawerClose>
    </div>
  </DrawerHeader>
)

RouteDrawer.Body = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex-1 overflow-y-auto px-6 py-4', className)} {...props}>
    {children}
  </div>
)

RouteDrawer.Footer = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <DrawerFooter
    className={cn('flex flex-row items-center justify-end gap-x-2 border-t px-6 py-4', className)}
    {...props}
  />
)

RouteDrawer.Title = DrawerTitle
RouteDrawer.Description = DrawerDescription
RouteDrawer.Close = DrawerClose
RouteDrawer.Form = RouteModalForm
