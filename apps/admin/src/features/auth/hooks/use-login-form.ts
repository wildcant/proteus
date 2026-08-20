import { z } from 'zod'
import type { AuthenticateResponse } from '#/api/generated/model'
import { useLogin } from '#/features/auth/api/auth'
import { useAppForm } from '#/lib/form-hook'
import type { SubmitFormParams } from '#/types/form'

const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, { error: 'Password is required' }),
})

export type LoginFormParams = SubmitFormParams<AuthenticateResponse>

export function useLoginForm(params?: LoginFormParams) {
  const loginMutation = useLogin()

  const form = useAppForm({
    defaultValues: { email: '', password: '' },
    validators: { onSubmit: LoginSchema },
    onSubmit: ({ value }) => {
      loginMutation.mutate(value, {
        onSuccess: (data) => {
          form.reset()
          params?.onSuccess?.(data)
        },
        onError: (error) => params?.onError?.(error.message),
        onSettled: () => params?.onSettled?.(),
      })
    },
  })

  return { form, isPending: loginMutation.isPending }
}
