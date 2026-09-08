import { useNavigate } from '@tanstack/react-router'
import '../router-types.ts'
import { type PropsWithChildren, useCallback, useMemo, useState } from 'react'
import { RouteModalProviderContext } from './route-modal-context'

type RouteModalProviderProps = PropsWithChildren<{
  prev: string | number
}>

export const RouteModalProvider = ({ prev, children }: RouteModalProviderProps) => {
  const navigate = useNavigate()
  const [closeOnEscape, setCloseOnEscape] = useState(true)

  const handleSuccess = useCallback(
    (path?: string) => {
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
