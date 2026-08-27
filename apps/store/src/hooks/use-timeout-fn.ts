import { useCallback, useEffect, useRef } from 'react'

export type UseTimeoutFnReturn = [() => boolean | null, () => void, () => void]

/**
 * Runs `fn` `ms` after the timer is set, and re-arms whenever the caller asks.
 *
 * The callback is held in a ref so a fresh closure on every render does not restart the timer —
 * only `ms` does.
 */
export function useTimeoutFn(fn: () => void, ms = 0): UseTimeoutFnReturn {
  const ready = useRef<boolean | null>(false)
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined)
  const callback = useRef(fn)

  const isReady = useCallback(() => ready.current, [])

  const set = useCallback(() => {
    ready.current = false
    if (timeout.current) clearTimeout(timeout.current)

    timeout.current = setTimeout(() => {
      ready.current = true
      callback.current()
    }, ms)
  }, [ms])

  const clear = useCallback(() => {
    ready.current = null
    if (timeout.current) clearTimeout(timeout.current)
  }, [])

  // Keep the ref pointing at the latest callback without disturbing a running timer.
  useEffect(() => {
    callback.current = fn
  }, [fn])

  // Set on mount, clear on unmount. `set` changes only when `ms` does, so listing it here is
  // what carries the ms dependency.
  useEffect(() => {
    set()

    return clear
  }, [set, clear])

  return [isReady, clear, set]
}
