import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { cn } from '@proteus/ui-core'
import { checkbox, checkboxIndicator } from '#/components/ui/checkbox/checkbox.variants'
import { Icon } from '#/components/ui/icon/icon'

type CheckboxProps = Omit<CheckboxPrimitive.Root.Props, 'className'> & { className?: string }

/** `checked` is Base UI's state, so the root and the glyph read it rather than a prop of their own. */
export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={(state) =>
        cn(
          checkbox({ checked: state.checked }),
          'peer relative shrink-0 outline-none transition-colors after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed',
          className,
        )
      }
      {...props}
    >
      {/* The indicator is the glyph itself: the set's indicator layer is the check. */}
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className={(state) => checkboxIndicator({ checked: state.checked })}
        render={<Icon name="check" />}
      />
    </CheckboxPrimitive.Root>
  )
}
