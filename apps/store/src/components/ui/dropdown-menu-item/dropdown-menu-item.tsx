import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import { cn } from '@proteus/ui-core'
import type { ReactNode } from 'react'
import {
  dropdownMenuItem,
  dropdownMenuItemIcon,
  dropdownMenuItemLabel,
} from '#/components/ui/dropdown-menu-item/dropdown-menu-item.variants'

type DropdownMenuItemProps = Omit<MenuPrimitive.Item.Props, 'className' | 'children'> & {
  className?: string
  /** The row the shopper is already on, filled so the list opens on it. */
  current?: boolean
  /** Decorative, before the label. */
  icon?: ReactNode
  children: ReactNode
}

/**
 * `highlighted` is Base UI's keyboard and pointer highlight, read from the item's state rather than
 * `:focus`, so the drawn variant is the one that renders.
 * `data-current` is what the set's positional rule reads to drop the rule under the current row.
 */
export function DropdownMenuItem({ className, current = false, icon, children, ...props }: DropdownMenuItemProps) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-current={current ? '' : undefined}
      className={({ highlighted }) =>
        cn(
          dropdownMenuItem({ current, highlighted }),
          'cursor-pointer select-none outline-none data-disabled:pointer-events-none',
          className,
        )
      }
      {...props}
    >
      {icon ? <span className={dropdownMenuItemIcon()}>{icon}</span> : null}
      <span className={dropdownMenuItemLabel({ current })}>{children}</span>
    </MenuPrimitive.Item>
  )
}
