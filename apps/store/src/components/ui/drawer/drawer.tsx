import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer'
import { cn } from '@proteus/ui-core'
import * as React from 'react'
import { drawer, drawerContent } from '#/components/ui/drawer/drawer.variants'
import { drawerOverlay } from '#/components/ui/drawer-overlay/drawer-overlay.variants'
import { drawerTitle, drawerTitleLabel } from '#/components/ui/drawer-title/drawer-title.variants'

type SwipeDirection = NonNullable<DrawerPrimitive.Root.Props['swipeDirection']>

type DrawerContextProps = {
  modal: DrawerPrimitive.Root.Props['modal']
  swipeDirection: SwipeDirection
}

const DrawerContext = React.createContext<DrawerContextProps | null>(null)

function useDrawer() {
  const context = React.useContext(DrawerContext)
  if (!context) {
    throw new Error('useDrawer must be used within a Drawer.')
  }
  return context
}

function Drawer({ modal = true, swipeDirection = 'down', ...props }: DrawerPrimitive.Root.Props) {
  const contextValue = React.useMemo(() => ({ modal, swipeDirection }), [modal, swipeDirection])

  return (
    <DrawerContext.Provider value={contextValue}>
      <DrawerPrimitive.Root data-slot="drawer" modal={modal} swipeDirection={swipeDirection} {...props} />
    </DrawerContext.Provider>
  )
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({ className, ...props }: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-overlay"
      className={cn(
        drawerOverlay(),
        // The scrim follows the swipe: it fades with the panel's progress and snaps back with no
        // transition while a finger is on it.
        'fixed inset-0 z-50 min-h-dvh select-none opacity-[max(var(--drawer-overlay-min-opacity,0),calc(1-var(--drawer-swipe-progress)))] transition-opacity duration-450 ease-drawer data-ending-style:pointer-events-none data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-swiping:duration-0 supports-[-webkit-touch-callout:none]:absolute',
        className,
      )}
      {...props}
    />
  )
}

/**
 * The positioned, swipeable panel without a look of its own: `DrawerContent` gives it the drawer's,
 * the route drawer its own. The transform composes the swipe, the nested-drawer stack and the
 * closed position per side, which is what Base UI's CSS variables are for.
 */
function DrawerPopup({ className, children, ...props }: DrawerPrimitive.Popup.Props) {
  const { modal, swipeDirection } = useDrawer()
  const swipeAxis = swipeDirection === 'down' || swipeDirection === 'up' ? 'y' : 'x'

  return (
    <DrawerPortal>
      {modal === true && <DrawerOverlay />}
      <DrawerPrimitive.Viewport
        data-slot="drawer-viewport"
        data-modal={modal}
        className="pointer-events-none fixed inset-0 z-50 select-none data-[modal=true]:pointer-events-auto"
      >
        <DrawerPrimitive.Popup
          data-slot="drawer-popup"
          data-swipe-axis={swipeAxis}
          className={cn(
            // Base.
            'group/drawer-popup transform-[translate3d(var(--translate-x,0px),var(--translate-y,0px),0)_scale(var(--stack-scale))] pointer-events-auto fixed z-50 m-(--drawer-inset,0px) h-(--drawer-content-height) max-h-(--drawer-content-max-height,none) min-h-0 w-(--drawer-content-width,auto) select-none outline-none transition-[transform,height,opacity,filter] duration-450 ease-toast will-change-transform [interpolate-size:allow-keywords]',
            // Nested.
            'data-nested-drawer-open:overflow-hidden data-nested-drawer-open:brightness-95',
            // Bleed: the strip behind the panel's leading edge while it overshoots on a swipe.
            'after:pointer-events-none after:absolute after:bg-(--drawer-bleed-background,var(--color-surface)) data-[swipe-axis=y]:after:inset-x-0 data-[swipe-axis=x]:after:inset-y-0 data-[swipe-direction=down]:after:top-full data-[swipe-direction=left]:after:right-full data-[swipe-direction=up]:after:bottom-full data-[swipe-direction=right]:after:left-full data-[swipe-axis=y]:after:h-(--bleed) data-[swipe-axis=x]:after:w-(--bleed)',
            // Sizing.
            '[--drawer-content-height:var(--drawer-height,auto)] data-[swipe-axis=x]:[--drawer-content-width:75%] data-[swipe-axis=y]:[--drawer-content-max-height:calc(100dvh-6rem)] data-[swipe-axis=x]:sm:[--drawer-content-width:24rem]',
            // Stack.
            '[--bleed:3rem] [--peek:1rem] [--stack-height:var(--drawer-frontmost-height,var(--drawer-height,0px))] [--stack-peek-offset:max(0px,calc((var(--nested-drawers)-var(--stack-progress))*var(--peek)))] [--stack-progress:clamp(0,var(--drawer-swipe-progress),1)] [--stack-scale-base:max(0,calc(1-(var(--nested-drawers)*var(--stack-step))))] [--stack-scale:clamp(0,calc(var(--stack-scale-base)+(var(--stack-step)*var(--stack-progress))),1)] [--stack-shrink:calc(1-var(--stack-scale))] [--stack-step:0.05]',
            // Transitions.
            'data-ending-style:transform-(--closed-transform) data-starting-style:transform-(--closed-transform) data-ending-style:data-nested-drawer-swiping:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-ending-style:data-swiping:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-ending-style:opacity-[0.9999] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-nested-drawer-swiping:duration-0 data-swiping:duration-0',
            // Axis: y.
            'data-[swipe-axis=y]:data-nested-drawer-open:h-(--stack-height) data-[swipe-axis=y]:inset-x-0',
            // Axis: x.
            'data-[swipe-axis=x]:inset-y-0',
            // Direction: down.
            'data-[swipe-direction=down]:bottom-0 data-[swipe-direction=down]:origin-bottom data-[swipe-direction=down]:[--closed-transform:translate3d(0,calc(100%+var(--drawer-inset,0px)+2px),0)] data-[swipe-direction=down]:[--translate-y:calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y)-var(--stack-peek-offset)-(var(--stack-shrink)*var(--stack-height)))]',
            // Direction: up.
            'data-[swipe-direction=up]:top-0 data-[swipe-direction=up]:origin-top data-[swipe-direction=up]:[--closed-transform:translate3d(0,calc(-100%-var(--drawer-inset,0px)-2px),0)] data-[swipe-direction=up]:[--translate-y:calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y)+var(--stack-peek-offset)+(var(--stack-shrink)*var(--stack-height)))]',
            // Direction: left.
            'data-[swipe-direction=left]:left-0 data-[swipe-direction=left]:origin-left data-[swipe-direction=left]:[--closed-transform:translate3d(calc(-100%-var(--drawer-inset,0px)-2px),0,0)] data-[swipe-direction=left]:[--translate-x:calc(var(--drawer-swipe-movement-x)+var(--stack-peek-offset)+(var(--stack-shrink)*100%))]',
            // Direction: right.
            'data-[swipe-direction=right]:right-0 data-[swipe-direction=right]:origin-right data-[swipe-direction=right]:[--closed-transform:translate3d(calc(100%+var(--drawer-inset,0px)+2px),0,0)] data-[swipe-direction=right]:[--translate-x:calc(var(--drawer-swipe-movement-x)-var(--stack-peek-offset)-(var(--stack-shrink)*100%))]',
            className,
          )}
          {...props}
        >
          <DrawerPrimitive.Content
            data-slot="drawer-content"
            className={cn(
              drawerContent(),
              'min-h-0 select-text overscroll-contain rounded-[inherit] transition-opacity duration-300 ease-drawer-content group-data-swiping/drawer-popup:select-none group-data-nested-drawer-open/drawer-popup:opacity-0 group-data-nested-drawer-swiping/drawer-popup:opacity-100',
            )}
          >
            {children}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPortal>
  )
}

/** `down` is Base UI's default but no drawer of the store's slides up from the bottom, so it is not drawn. */
const drawnSides: Record<SwipeDirection, 'right' | 'left' | 'up' | null> = {
  right: 'right',
  left: 'left',
  up: 'up',
  down: null,
}

function DrawerContent({ className, ...props }: DrawerPrimitive.Popup.Props) {
  const { swipeDirection } = useDrawer()
  return <DrawerPopup className={cn(drawer({ side: drawnSides[swipeDirection] }), className)} {...props} />
}

function DrawerHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="drawer-header" className={cn('shrink-0', className)} {...props} />
}

function DrawerFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="drawer-footer" className={cn('shrink-0', className)} {...props} />
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn(drawerTitle(), drawerTitleLabel(), className)}
      {...props}
    />
  )
}

function DrawerDescription({ ...props }: DrawerPrimitive.Description.Props) {
  return <DrawerPrimitive.Description data-slot="drawer-description" {...props} />
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPopup,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
}
