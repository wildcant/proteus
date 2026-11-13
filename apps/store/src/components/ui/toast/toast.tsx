import { Toast as ToastPrimitive } from '@base-ui/react/toast'
import { cn, toast } from '@proteus/ui-core'
import { Icon } from '#/components/ui/icon/icon'
import {
  toastClose,
  toastCloseIcon,
  toastContent,
  toastDescription,
  toastIcon,
  toastText,
  toastTitle,
  toast as toastVariants,
} from '#/components/ui/toast/toast.variants'

/**
 * The stack: each toast behind the front one peeks `--peek` above it and shrinks by a tenth per
 * index; expanded (hover or focus), they fan out by their own heights. Entering and leaving slide
 * by 150 % of the toast, along the swipe when there is one.
 */
const toastMotion = [
  'group/toast pointer-events-auto absolute right-0 bottom-0 z-[calc(1000-var(--toast-index))] w-full origin-bottom select-none outline-none will-change-transform focus-visible:ring-3 focus-visible:ring-focus-ring',
  '[--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))]',
  'transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] h-(--height) [transition:transform_500ms_cubic-bezier(0.22,1,0.36,1),opacity_500ms,height_150ms]',
  "after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
  'data-expanded:transform-[translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))] data-expanded:h-(--toast-height)',
  'data-starting-style:transform-[translateY(150%)] data-limited:opacity-0',
  '[&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:transform-[translateY(150%)]',
  'data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+150%))]',
  'data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]',
  'data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]',
  'data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-150%))]',
  'data-expanded:data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+150%))]',
  'data-expanded:data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]',
  'data-expanded:data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]',
  'data-expanded:data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-150%))]',
]

function ToastList({ closeLabel }: { closeLabel: string }) {
  const { toasts } = ToastPrimitive.useToastManager()

  return toasts.map((toastItem) => (
    <ToastPrimitive.Root
      key={toastItem.id}
      toast={toastItem}
      data-slot="toast"
      className={cn(toastVariants(), toastMotion)}
    >
      <ToastPrimitive.Content
        data-slot="toast-content"
        className={cn(
          toastContent(),
          'h-full overflow-hidden transition-opacity duration-250 ease-toast data-behind:opacity-0 data-expanded:opacity-100',
        )}
      >
        {toastItem.type === 'error' && (
          <Icon name="octagon-x" data-slot="toast-icon" aria-hidden="true" className={cn(toastIcon(), 'shrink-0')} />
        )}
        <div className={cn(toastText(), 'min-w-0')}>
          <ToastPrimitive.Title data-slot="toast-title" className={toastTitle()} />
          <ToastPrimitive.Description data-slot="toast-description" className={toastDescription()} />
        </div>
        <ToastPrimitive.Close
          data-slot="toast-close"
          aria-label={closeLabel}
          className={cn(
            toastClose(),
            "relative shrink-0 cursor-pointer outline-none transition-all after:absolute after:-inset-2 after:content-['']",
          )}
        >
          <Icon name="x" aria-hidden="true" className={toastCloseIcon()} />
        </ToastPrimitive.Close>
      </ToastPrimitive.Content>
    </ToastPrimitive.Root>
  ))
}

type ToasterProps = ToastPrimitive.Provider.Props & {
  /** Moves the toast lane, so a bottom-pinned control (the PDP's action bar) stays clear of it. */
  viewportClassName?: string
  /** Accessible label for each toast's close button. */
  closeLabel?: string
}

/** The store's toast lane over ui-core's one manager, so `toast.add()` from anywhere lands here. */
function Toaster({
  children,
  toastManager = toast,
  viewportClassName,
  closeLabel = 'Close toast',
  ...props
}: ToasterProps) {
  return (
    <ToastPrimitive.Provider toastManager={toastManager} {...props}>
      {children}
      <ToastPrimitive.Portal data-slot="toast-portal">
        <ToastPrimitive.Viewport
          data-slot="toast-viewport"
          className={cn(
            'pointer-events-none fixed inset-x-4 bottom-4 z-99 mx-auto w-auto max-w-sm outline-none sm:right-4 sm:left-auto sm:mx-0 sm:w-full',
            viewportClassName,
          )}
        >
          <ToastList closeLabel={closeLabel} />
        </ToastPrimitive.Viewport>
      </ToastPrimitive.Portal>
    </ToastPrimitive.Provider>
  )
}

export { Toaster }
