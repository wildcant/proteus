import { useNavigate } from '@tanstack/react-router'
import '../router-types.ts'
import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RouteModalProviderContext } from './route-modal-context'

type RouteModalProviderProps = PropsWithChildren<{
  prev: string | number
}>

export const RouteModalProvider = ({ prev, children }: RouteModalProviderProps) => {
  const navigate = useNavigate()
  const [closeOnEscape, setCloseOnEscape] = useState(true)

  /**
   * Whether this modal is still on screen when its form's write comes back.
   *
   * Form hooks await `mutateAsync`, whose promise resolves whether or not the merchant is still
   * here — unlike the per-call `mutate` callbacks it replaced, which React Query drops on unmount.
   * So a save the merchant walked away from still reaches `handleSuccess`.
   */
  const isMounted = useRef(true)
  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  const handleSuccess = useCallback(
    (path?: string) => {
      // The write and its cache invalidation already happened. Navigating now would only pull the
      // merchant out of wherever they went after closing this drawer.
      if (!isMounted.current) return

      const to = path || prev
      // Set success state on current location before navigating back
      window.history.replaceState({ ...window.history.state, isSubmitSuccessful: true }, '')

      if (typeof to === 'number') {
        window.history.go(to)
      } else {
        navigate({
          to,
          replace: true,
          state: { isSubmitSuccessful: true },
        })
      }
    },
    [navigate, prev],
  )

  const value = useMemo(() => ({ handleSuccess, setCloseOnEscape, closeOnEscape }), [handleSuccess, closeOnEscape])

  return <RouteModalProviderContext.Provider value={value}>{children}</RouteModalProviderContext.Provider>
}
