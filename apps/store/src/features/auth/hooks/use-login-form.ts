import { StoreLoginBody } from '@proteus/http-schemas/store'
import type { AuthenticateResponse } from '#/api/generated/model'
import { DEV_EMAIL, PREFILL_FORMS } from '#/env.ts'
import { useLogin } from '#/features/auth/api/auth'
import { errorMessage, type SubmitFormParams } from '#/lib/form'
import { useAppForm } from '#/lib/form-hook'

export type LoginFormParams = SubmitFormParams<AuthenticateResponse>

const EMPTY: StoreLoginBody = { email: '', password: '' }
const TEST: StoreLoginBody = { email: DEV_EMAIL, password: '123' }

export function useLoginForm(params?: LoginFormParams) {
  const loginMutation = useLogin()

  const form = useAppForm({
    defaultValues: PREFILL_FORMS ? TEST : EMPTY,
    validators: { onSubmit: StoreLoginBody },
    onSubmit: async ({ value }) => {
      try {
        const data = await loginMutation.mutateAsync(value)
        form.reset()
        params?.onSuccess?.(data)
      } catch (error) {
        params?.onError?.(errorMessage(error))
      } finally {
        params?.onSettled?.()
      }
    },
  })

  return { form }
}
