import { cn } from '@proteus/ui'
import { ChevronDownIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { FloatingLabel } from '#/components/form/floating-label.tsx'
import { LabelText } from '#/components/form/label-text.tsx'

type FloatingLabelSelectProps = Omit<ComponentProps<'select'>, 'size'> & {
  id: string
  label: string
}

/**
 * The same 56px box as `FloatingLabelInput`, around a native select.
 *
 * Its own `<select>`, not `@proteus/ui`'s `NativeSelect`, whose `className` reaches the wrapper
 * only — styling the control would take eight `**:data-[slot=native-select]:` selectors. Chevron
 * is ours (`appearance-none`), at `right-4` to match this box's wider gutter.
 */
export function FloatingLabelSelect({ id, label, className, required, children, ...props }: FloatingLabelSelectProps) {
  return (
    <div className="relative">
      <select
        id={id}
        // aria-required rather than the `required` attribute, for the same reason the input gives:
        // the latter hands validation to the browser and its native bubbles.
        aria-required={required}
        className={cn(
          // 16px on small screens so iOS does not zoom the page on focus.
          'h-14 w-full appearance-none bg-transparent py-0 pt-5 pr-10 pb-1 pl-4 text-base outline-none md:text-sm',
          'border border-line focus-visible:border-ink aria-invalid:border-sale',
          'disabled:pointer-events-none disabled:opacity-50',
          // The placeholder option is not a value. Muted keeps "Select country" from reading as a
          // country the shopper picked.
          !props.value && 'text-ink-muted',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {/* No `peer` on the select and no resting state: see FloatingLabel. */}
      <FloatingLabel htmlFor={id}>
        <LabelText required={required}>{label}</LabelText>
      </FloatingLabel>
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-muted"
      />
    </div>
  )
}
