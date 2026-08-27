import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback } from 'react'
import { z } from 'zod'

/**
 * Modals are URL state, not component state.
 *
 * A modal is a thing the shopper can be looking at, so it belongs in the address bar with
 * everything else that describes what they are looking at: it survives a refresh, it can be
 * linked to, and hardware back closes it because closing *is* a navigation.
 *
 * Most modals in this app cannot have a path of their own. A route renders in place of the
 * page, and these panels render on top of one — search opens over the home page, the PLP, a
 * PDP or the cart, so there is no single parent route to nest it under the way admin nests
 * `_detail/edit` under `_detail`. A globally defined search param is the form URL state takes
 * when the state is "which overlay is open", independent of which page it is over.
 *
 * One param rather than one flag per modal: two modals open at once is not a state this app
 * has, and an enum makes that unrepresentable instead of merely unlikely. It also does the
 * hand-off for free — the menu's search trigger sets `modal` to `search`, and the menu closing
 * is the same navigation that opens the panel.
 */
export const MODAL_NAMES = ['menu', 'search', 'cart'] as const

export type ModalName = (typeof MODAL_NAMES)[number]

/**
 * Lives on `__root__`, so every route inherits it — search params merge down the matched
 * route tree, which is what lets a page validate only its own params and still carry this one.
 *
 * `.catch` so a hand-typed `?modal=nonsense` drops the param instead of erroring the route.
 */
export const modalSearchSchema = z.object({
  modal: z.enum(MODAL_NAMES).optional().catch(undefined),
})

export function useModal(name: ModalName) {
  const navigate = useNavigate()
  const { modal } = useSearch({ strict: false })

  const setOpen = useCallback(
    (open: boolean) => {
      navigate({
        to: '.',
        search: (prev) => ({ ...prev, modal: open ? name : undefined }),
        // Opening pushes, so hardware back closes the modal. Closing replaces, so the entry
        // opening pushed is consumed rather than left for a forward navigation to re-enter.
        replace: !open,
      })
    },
    [navigate, name],
  )

  return { isOpen: modal === name, setOpen }
}
