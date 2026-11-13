import { useRender } from '@base-ui/react/use-render'
import { cn } from '@proteus/ui-core'
import { searchControl, searchControlIcon } from '#/components/store/search-control/search-control.variants'
import { Icon } from '#/components/ui/icon/icon'

type SearchControlProps = useRender.ComponentProps<'div'>

/**
 * The filled search treatment with no opinion about which element carries it.
 *
 * The bar and the drawer show the same control but are not the same thing: the bar's is a
 * button that opens the drawer, the drawer's is a form around the one real input in the
 * app. Keeping the look here means there is never a second `<input>` to keep in sync with
 * the first — the reason the bar is a button at all.
 *
 * `useRender` is base-ui's public render-prop hook, the same mechanism every primitive in
 * `@proteus/ui` already exposes. It merges className, style, refs and event handlers
 * rather than clobbering them, which hand-rolled `cloneElement` does not.
 *
 * Its width is the caller's: the bar fixes it, the side menu stretches it.
 */
export function SearchControl({ render, className, children, ...props }: SearchControlProps) {
  return useRender({
    render,
    defaultTagName: 'div',
    props: {
      ...props,
      className: cn(
        searchControl(),
        'focus-within:outline-2 focus-within:outline-ink focus-within:outline-offset-2',
        className,
      ),
      children: (
        <>
          <Icon name="search" className={cn(searchControlIcon(), 'pointer-events-none shrink-0')} />
          {children}
        </>
      ),
    },
  })
}
