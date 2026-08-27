import { type DependencyList, useEffect } from 'react'
import { useTimeoutFn } from './use-timeout-fn'

export type UseDebounceReturn = [() => boolean | null, () => void]

/**
 * Calls `fn` once `deps` have stopped changing for `ms`.
 *
 * `deps` is the caller's contract in the same way `useEffect`'s own list is — the hook cannot
 * know what its callback reads, which is why it is forwarded rather than inspected.
 */
export function useDebounce(fn: () => void, ms = 0, deps: DependencyList = []): UseDebounceReturn {
  const [isReady, cancel, reset] = useTimeoutFn(fn, ms)

  // biome-ignore lint/correctness/useExhaustiveDependencies: deps is this hook's own parameter
  useEffect(reset, deps)

  return [isReady, cancel]
}
