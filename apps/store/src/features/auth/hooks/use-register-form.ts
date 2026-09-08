import { StoreSignupBody } from '@proteus/http-schemas/store'
import type { AuthenticateResponse } from '#/api/generated/model'
import { DEV_SIGNUP_EMAIL, PREFILL_FORMS } from '#/env.ts'
import { useRegister } from '#/features/auth/api/auth'
import { errorMessage, type SubmitFormParams } from '#/lib/form'
import { useAppForm } from '#/lib/form-hook'

export type RegisterFormParams = SubmitFormParams<AuthenticateResponse>

const EMPTY: StoreSignupBody = { firstName: '', lastName: '', email: '', password: '' }
const TEST: StoreSignupBody = {
  firstName: 'Joe',
  lastName: 'Doe',
  email: DEV_SIGNUP_EMAIL,
  password: '123',
}

export function useRegisterForm(params?: RegisterFormParams) {
  const registerMutation = useRegister()

  const form = useAppForm({
    defaultValues: PREFILL_FORMS ? TEST : EMPTY,
    validators: { onSubmit: StoreSignupBody },
    onSubmit: async ({ value }) => {
      try {
        const data = await registerMutation.mutateAsync(value)
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
