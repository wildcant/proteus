import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

/** The body every hand-picked group's member endpoint takes. */
type MembershipChange = { add: string[]; remove: string[] }

// `onSuccess` is restated: `SubmitFormParams` picks its signature by a conditional on the response,
// which stays unresolved for a generic one.
export type EditProductGroupFormParams<TResponse> = Omit<SubmitFormParams, 'onSuccess'> & {
  onSuccess?: (data: TResponse) => void
  /** The group's members when the picker opened. */
  memberIds: string[]
  /** The group's member write — a Category's or a Collection's `mutateAsync`. */
  setMembers: (change: MembershipChange) => Promise<TResponse>
}

/**
 * A group's members as a set of checked ids. Saving sends only the difference from what was checked
 * when the picker opened, as `{ add, remove }`, so a product added elsewhere meanwhile is left alone —
 * and joining a Collection never takes a product out of another.
 */
export function useEditProductGroupForm<TResponse>({
  memberIds,
  setMembers,
  ...params
}: EditProductGroupFormParams<TResponse>) {
  const form = useAppForm({
    defaultValues: { productIds: memberIds },
    onSubmit: async ({ value }) => {
      const before = new Set(memberIds)
      const after = new Set(value.productIds)
      const add = value.productIds.filter((id) => !before.has(id))
      const remove = memberIds.filter((id) => !after.has(id))

      try {
        const data = await setMembers({ add, remove })
        form.reset()
        params.onSuccess?.(data)
      } catch (error) {
        params.onError?.(errorMessage(error))
      } finally {
        params.onSettled?.()
      }
    },
  })

  return { form }
}
