import { createFormHook } from '@tanstack/react-form'
import { CheckboxField } from '#/components/form/checkbox-field.tsx'
import { SelectField } from '#/components/form/select-field.tsx'
import { TextField } from '#/components/form/text-field.tsx'
import { fieldContext, formContext } from '#/lib/form-context.ts'

export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, SelectField, CheckboxField },
  formComponents: {},
})
