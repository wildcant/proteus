import { AdminAcceptInvite } from '@proteus/http-schemas/admin'
import z from 'zod'
import { useAcceptInvite } from '#/features/users/api/invites'
import { useAppForm } from '#/lib/form-hook'
import type { SubmitFormParams } from '#/types/form'

const CreateAccountSchema = AdminAcceptInvite.extend({
  confirmPassword: z.string().min(1),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export type CreateAccountFormParams = SubmitFormParams & {
  token: string
}

export function useCreateAccountForm(params: CreateAccountFormParams) {
  const acceptInviteMutation = useAcceptInvite()

  const form = useAppForm({
    defaultValues: { token: params.token, name: '', password: '', confirmPassword: '' },
    validators: { onSubmit: CreateAccountSchema },
    onSubmit: ({ value }) => {
      acceptInviteMutation.mutate(
        { token: value.token, name: value.name, password: value.password },
        {
          onSuccess: () => {
            form.reset()
            params.onSuccess?.()
          },
          onError: (error) => params.onError?.(error.message),
          onSettled: () => params.onSettled?.(),
        },
      )
    },
  })

  return { form, isPending: acceptInviteMutation.isPending }
}
