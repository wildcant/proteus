import { Button } from '@proteus/ui'
import { Form } from '#/components/form/form.tsx'
import {
  type UpdateCustomerFormParams,
  useUpdateCustomerForm,
} from '#/features/customers/hooks/use-update-customer-form.ts'

type UpdateCustomerFormProps = UpdateCustomerFormParams

export function UpdateCustomerForm(props: UpdateCustomerFormProps) {
  const { form } = useUpdateCustomerForm(props)

  return (
    <Form onSubmit={form.handleSubmit} className="flex flex-1 flex-wrap items-center gap-3">
      <form.AppForm>
        <form.AppField name="firstName">
          {(field) => <field.TextField label="First name" className="w-auto flex-1" />}
        </form.AppField>
        <form.AppField name="lastName">
          {(field) => <field.TextField label="Last name" className="w-auto flex-1" />}
        </form.AppField>
        <form.AppField name="email">
          {(field) => <field.TextField label="Email" className="w-auto flex-1" type="email" />}
        </form.AppField>
        <div className="flex gap-2 self-end">
          <form.SubmitButton size="sm">Save</form.SubmitButton>
          <Button type="button" variant="outline" size="sm" onClick={props.onSettled}>
            Cancel
          </Button>
        </div>
      </form.AppForm>
    </Form>
  )
}
