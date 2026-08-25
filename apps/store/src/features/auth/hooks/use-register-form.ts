import { StoreSignupBody } from '@proteus/http-schemas/store'
import type { AuthenticateResponse } from '#/api/generated/model'
import { DEV_SIGNUP_EMAIL, PREFILL_FORMS } from '#/env.ts'
import { useRegister } from '#/features/auth/api/auth'
import type { SubmitFormParams } from '#/lib/form'
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
    onSubmit: ({ value }) => {
      registerMutation.mutate(value, {
        onSuccess: (data) => {
          form.reset()
          params?.onSuccess?.(data)
        },
        onError: (error) => params?.onError?.(error.message),
        onSettled: () => params?.onSettled?.(),
      })
    },
  })

  return { form, isPending: registerMutation.isPending }
}
