import { Button as BaseButton, cn } from '@proteus/ui'
import type { ComponentProps } from 'react'

type ButtonProps = ComponentProps<typeof BaseButton>

const storeStyles: Record<string, string> = {
  default: 'h-10 rounded-none px-6 text-sm font-medium tracking-wide uppercase',
  outline:
    'h-10 rounded-none border-foreground/20 bg-transparent px-6 text-sm font-medium tracking-wide uppercase hover:bg-foreground/5',
  ghost: 'h-10 rounded-none px-6 text-sm font-medium',
  link: 'h-auto px-0 text-sm font-medium',
}

export function Button({ variant = 'default', size, className, ...props }: ButtonProps) {
  const overrides = size ? undefined : storeStyles[variant ?? 'default']

  return <BaseButton variant={variant} size={size} className={cn(overrides, className)} {...props} />
}
