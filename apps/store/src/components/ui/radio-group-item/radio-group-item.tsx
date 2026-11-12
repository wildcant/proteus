import { Radio as RadioPrimitive } from '@base-ui/react/radio'
import { cn } from '@proteus/ui-core'
import {
  radioGroupItem,
  radioGroupItemDot,
  radioGroupItemIndicator,
} from '#/components/ui/radio-group-item/radio-group-item.variants'

type RadioGroupItemProps = Omit<RadioPrimitive.Root.Props, 'className'> & { className?: string }

/** `checked` is Base UI's state; the indicator only mounts while checked, so its layers take `checked: true`. */
export function RadioGroupItem({ className, ...props }: RadioGroupItemProps) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={(state) =>
        cn(
          radioGroupItem({ checked: state.checked }),
          'peer relative shrink-0 outline-none after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed',
          className,
        )
      }
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className={(state) => radioGroupItemIndicator({ checked: state.checked })}
      >
        <span className={radioGroupItemDot({ checked: true })} />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  )
}
