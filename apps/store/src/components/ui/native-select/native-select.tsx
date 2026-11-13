import { cn } from '@proteus/ui-core'
import type { ComponentProps } from 'react'
import { Icon } from '#/components/ui/icon/icon'
import { nativeSelect, nativeSelectIcon, nativeSelectValue } from '#/components/ui/native-select/native-select.variants'

type NativeSelectProps = Omit<ComponentProps<'select'>, 'size'> & {
  /**
   * The positioning box that holds the select and its chevron. Only reach for this to change the
   * box itself — its width, or where the chevron sits inside it.
   */
  wrapperClassName?: string
}

/**
 * The drawn box is the `<select>` itself, as an input's is, so a click anywhere in it, padding and
 * chevron included, opens the list. The wrapper only positions the chevron: `flex` is what lets the
 * drawn `self-center` centre it. `className` lands on the `<select>`, the control a caller means.
 */
export function NativeSelect({ className, wrapperClassName, ...props }: NativeSelectProps) {
  return (
    <div className={cn('relative flex w-fit', wrapperClassName)} data-slot="native-select-wrapper">
      <select
        data-slot="native-select"
        className={cn(
          nativeSelect(),
          nativeSelectValue(),
          'min-w-0 select-none appearance-none outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ink/50 disabled:pointer-events-none disabled:cursor-not-allowed',
          className,
        )}
        {...props}
      />
      <Icon
        name="chevron-down"
        className={cn(nativeSelectIcon(), 'pointer-events-none select-none')}
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  )
}

/** The open list is the platform's, so options take its system colours. */
export function NativeSelectOption({ className, ...props }: ComponentProps<'option'>) {
  return (
    <option data-slot="native-select-option" className={cn('bg-[Canvas] text-[CanvasText]', className)} {...props} />
  )
}
