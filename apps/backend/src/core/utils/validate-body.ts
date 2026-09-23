import { i18n } from '@proteus/utils'
import type { z } from 'zod'
import { AppError, ErrorTypes } from '../errors/app-error.js'
import { toValidationIssues } from '../errors/format-zod-issues.js'

export function validateBody<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data, { reportInput: true })

  if (result.success) {
    return result.data
  }

  throw new AppError({
    type: ErrorTypes.INVALID_DATA,
    message: i18n.t('Invalid request body'),
    issues: toValidationIssues(result.error.issues),
  })
}
