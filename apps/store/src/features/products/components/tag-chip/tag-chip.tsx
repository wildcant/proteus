import { useRender } from '@base-ui/react/use-render'
import { cn } from '@proteus/ui-core'
import { Icon } from '#/components/ui/icon/icon'
import {
  tagChip,
  tagChipLabel,
  tagChipRemove,
  tagChipX,
} from '#/features/products/components/tag-chip/tag-chip.variants'

type TagChipProps = useRender.ComponentProps<'button'> & {
  /** Chosen chips fill with ink and carry the remove mark. */
  chosen?: boolean
}

/**
 * A bordered chip: a Tag value to toggle on a list, or a child category to go to. Polymorphic
 * through base-ui's `useRender`, so a chip that navigates is `render={<Link … />}`.
 */
export function TagChip({ render, chosen = false, className, children, ...props }: TagChipProps) {
  return useRender({
    render,
    defaultTagName: 'button',
    props: {
      ...props,
      className: cn(tagChip({ chosen }), tagChipLabel({ chosen }), className),
      children: (
        <>
          {children}
          <Icon name="x" aria-hidden className={cn(tagChipRemove({ chosen }), tagChipX())} strokeWidth={1.5} />
        </>
      ),
    },
  })
}
