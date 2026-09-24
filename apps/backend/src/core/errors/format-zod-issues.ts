import type { z } from 'zod'

/**
 * A raw Zod issue as a request validation error carries it: the schema's message still untranslated,
 * so the response can render it in the request's language. Type-only, so `core/` stays library-free.
 */
export type ValidationIssue = z.core.$ZodIssue

/** How many issues a response lists; the rest are left for the client to find on the next submit. */
const MAX_ISSUES = 3

/**
 * The issues of a failed parse run with `reportInput`, ready to carry on an `AppError`. Zod's
 * default for a wrong type names what it received, so an `invalid_type` issue keeps its `input`;
 * every other issue drops it, so a submitted password never rides along on an error.
 */
export function toValidationIssues(issues: readonly ValidationIssue[]): ValidationIssue[] {
  return issues.slice(0, MAX_ISSUES).map((issue) => {
    if (issue.code === 'invalid_type') return issue
    const { input: _input, ...rest } = issue
    return rest as ValidationIssue
  })
}

/**
 * `email: Enter a valid email address; name: Name is required`. Only joins: each issue's own text
 * comes from `render` — the issue's English message for logs, the request's language for responses.
 */
export function formatZodIssues(
  issues: readonly ValidationIssue[],
  render: (issue: ValidationIssue) => string,
): string {
  return issues
    .slice(0, MAX_ISSUES)
    .map((issue) => {
      const path = issue.path.map(String).join('.')
      return path ? `${path}: ${render(issue)}` : render(issue)
    })
    .join('; ')
}
