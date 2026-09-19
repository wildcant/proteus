import { useMe } from '#/features/auth/api/auth'

export function hasFeature(allowedActions: string[], key: string): boolean {
  return allowedActions.includes(key)
}

export function useHasFeature(key: string): boolean {
  const { allowedActions } = useMe()
  return hasFeature(allowedActions ?? [], key)
}
