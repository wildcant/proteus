import { useEffect, useState } from 'react'

/** Trails `value` by `delay`, so a field that fires per keystroke drives one query per pause. */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return settled
}
