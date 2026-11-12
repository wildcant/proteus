import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group'
import { cn } from '@proteus/ui-core'
import { radioGroup } from '#/components/ui/radio-group/radio-group.variants'

type RadioGroupProps = Omit<RadioGroupPrimitive.Props, 'className'> & { className?: string }

export function RadioGroup({ className, ...props }: RadioGroupProps) {
  return <RadioGroupPrimitive data-slot="radio-group" className={cn(radioGroup(), className)} {...props} />
}
