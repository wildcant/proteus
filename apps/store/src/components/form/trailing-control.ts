/**
 * Shared by every control that sits in a field's right gutter — the password reveal, the help `?`.
 *
 * Its own module rather than a second export beside `FloatingLabel`: a file that exports both a
 * component and a constant loses Fast Refresh, which is what `useComponentExportOnlyModules` is
 * about.
 */
export const TRAILING_CONTROL =
  'text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2'
