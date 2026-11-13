import { cn } from '@proteus/ui-core'
import type { ComponentProps } from 'react'
import { LabelText } from '#/components/form/label-text.tsx'
import { FloatingLabel } from '#/components/store/floating-label/floating-label'
import {
  floatingLabelSelect,
  floatingLabelSelectChevron,
  floatingLabelSelectFloatingLabel,
  floatingLabelSelectGlyph,
  floatingLabelSelectSelect,
  floatingLabelSelectValue,
} from '#/components/store/floating-label-select/floating-label-select.variants'
import { Icon } from '#/components/ui/icon/icon'

type FloatingLabelSelectProps = Omit<ComponentProps<'select'>, 'size'> & {
  id: string
  label: string
}

/**
 * The same 56px box as `FloatingLabelInput`, around a native select.
 *
 * Its own `<select>`, not the store's `NativeSelect`: the floating label has to be the select's
 * sibling inside this box, and the primitive owns that box. Chevron is ours (`appearance-none`), at
 * `right-4` to match this box's wider gutter.
 *
 * The design draws the placeholder look (muted "Select country"); a chosen value is ink, so the
 * value's colour follows the data.
 */
export function FloatingLabelSelect({ id, label, className, required, children, ...props }: FloatingLabelSelectProps) {
  return (
    <div className={cn(floatingLabelSelect(), className)}>
      <select
        id={id}
        // aria-required rather than the `required` attribute, for the same reason the input gives:
        // the latter hands validation to the browser and its native bubbles.
        aria-required={required}
        className={cn(
          floatingLabelSelectSelect(),
          floatingLabelSelectValue(),
          'min-w-0 appearance-none bg-transparent outline-none',
          'focus-visible:border-ink aria-invalid:border-sale',
          'disabled:pointer-events-none disabled:opacity-50',
          !!props.value && 'text-ink',
        )}
        {...props}
      >
        {children}
      </select>
      {/* No `peer` on the select and no resting state: see FloatingLabel. */}
      <FloatingLabel htmlFor={id} className={floatingLabelSelectFloatingLabel()}>
        <LabelText required={required}>{label}</LabelText>
      </FloatingLabel>
      <Icon
        name="chevron-down"
        aria-hidden="true"
        className={cn(floatingLabelSelectChevron(), floatingLabelSelectGlyph(), 'pointer-events-none shrink-0')}
      />
    </div>
  )
}
