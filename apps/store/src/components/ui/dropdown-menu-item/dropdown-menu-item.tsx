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
 *
 * The rule between rows is the set's top border; it stops against the first row and either side of
 * the current one, because the fill is already the edge there and a line running into it reads as a
 * row split in two. That is position, which the design can't draw per instance.
 */
export function DropdownMenuItem({ className, current = false, icon, children, ...props }: DropdownMenuItemProps) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-current={current ? '' : undefined}
      className={({ highlighted }) =>
        cn(
          dropdownMenuItem({ current, highlighted }),
          'cursor-pointer select-none outline-none first:border-transparent data-disabled:pointer-events-none [[data-current]+&]:border-transparent',
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
