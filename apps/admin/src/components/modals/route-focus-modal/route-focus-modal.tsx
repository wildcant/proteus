import { Button, cn, Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from '@proteus/ui'
import { useNavigate } from '@tanstack/react-router'
import { XIcon } from 'lucide-react'
import { type PropsWithChildren, useEffect, useState } from 'react'
import { RouteModalForm } from '../route-modal-form/route-modal-form'
import { RouteModalProvider } from '../route-modal-provider/route-provider'
import { useRouteModal } from '../route-modal-provider/use-route-modal'

type RouteFocusModalProps = PropsWithChildren<{
  prev?: string | number
}>

/**
 * Full-screen route-driven modal using a bottom-up Drawer.
 *
 * Styled to match Medusa's FocusModal: full viewport with 8px inset,
 * rounded corners, and border on all sides. Opens on mount, navigates
 * to the parent route on close.
 *
 * Compound API: `.Header`, `.Title`, `.Description`, `.Body`, `.Footer`,
 * `.Close`, `.Form` (unsaved-changes guard).
 */
export function RouteFocusModal({ prev = '..', children }: RouteFocusModalProps) {
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
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <RouteModalProvider prev={prev}>
        <RouteFocusModalContent>{children}</RouteFocusModalContent>
      </RouteModalProvider>
    </Drawer>
  )
}

function RouteFocusModalContent({ children }: PropsWithChildren) {
  const { closeOnEscape } = useRouteModal()

  return (
    <DrawerContent
      className="shadow-lg data-[swipe-direction=down]:rounded-lg data-[swipe-direction=down]:border"
      style={
        {
          '--drawer-inset': '8px',
          '--drawer-height': 'calc(100dvh - 16px)',
          '--drawer-content-max-height': 'none',
        } as React.CSSProperties
      }
      onKeyDown={
        !closeOnEscape
          ? (e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
              }
            }
          : undefined
      }
    >
      {children}
    </DrawerContent>
  )
}

RouteFocusModal.Header = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex shrink-0 items-center justify-between gap-x-4 border-b px-4 py-2', className)} {...props}>
    <div className="flex items-center gap-x-2">
      <DrawerClose render={<Button variant="ghost" size="icon-sm" />}>
        <XIcon className="size-4" />
        <span className="sr-only">Close</span>
      </DrawerClose>
      <kbd className="inline-flex h-5 items-center rounded border px-1 font-mono text-[11px] text-muted-foreground">
        esc
      </kbd>
    </div>
    {children}
  </div>
)

/**
 * The modal's scrolling region, always full width so the scrollbar sits against the window edge
 * rather than against the content column.
 *
 * Centring and padding therefore belong on the children, not here — a body styled to a column
 * would take its scrollbar with it. A body that manages its own height instead of scrolling, like
 * the media grids, overrides `overflow` through `className`.
 */
RouteFocusModal.Body = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('w-full flex-1 overflow-y-auto', className)} {...props}>
    {children}
  </div>
)

RouteFocusModal.Footer = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center justify-end gap-x-2 border-t p-4', className)} {...props} />
)

RouteFocusModal.Title = DrawerTitle
RouteFocusModal.Description = DrawerDescription
RouteFocusModal.Close = DrawerClose
RouteFocusModal.Form = RouteModalForm
