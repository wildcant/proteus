import { z } from 'zod'
import type { AuthenticateResponse } from '#/api/generated/model'
import { useLogin } from '#/features/auth/api/auth'
import { useAppForm } from '#/lib/form-hook'
import { errorMessage, type SubmitFormParams } from '#/types/form'

// Hand-written rather than taken from `http-schemas`: the admin login route's body is the shared
// `AuthBody`, a `z.record(string, string)` too loose to drive a form.
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
