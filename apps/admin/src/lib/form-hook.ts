import { createFormHook } from '@tanstack/react-form'
import { CheckboxField } from '#/components/form/checkbox-field.tsx'
import { FileUploadField } from '#/components/form/file-upload-field.tsx'
import { NumberField } from '#/components/form/number-field.tsx'
import { SwitchField } from '#/components/form/switch-field.tsx'
import { TextField } from '#/components/form/text-field.tsx'
import { TextareaField } from '#/components/form/textarea-field.tsx'
import { fieldContext, formContext } from '#/lib/form-context.ts'

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, TextareaField, CheckboxField, SwitchField, NumberField, FileUploadField },
  formComponents: {},
})
