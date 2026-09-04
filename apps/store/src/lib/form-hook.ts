import { createFormHook } from '@tanstack/react-form'
import { CheckboxField } from '#/components/form/checkbox-field.tsx'
import { DeliveryCountryField } from '#/components/form/delivery-country-field.tsx'
import { SelectField } from '#/components/form/select-field.tsx'
import { SubmitButton } from '#/components/form/submit-button'
import { TextField } from '#/components/form/text-field.tsx'
import { fieldContext, formContext } from '#/lib/form-context.ts'

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, SelectField, CheckboxField, DeliveryCountryField },
  formComponents: { SubmitButton },
})
