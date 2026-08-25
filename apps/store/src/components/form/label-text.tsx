import type { ReactNode } from 'react'

/**
 * Label text with an optional required marker.
 *
 * The marker has to share a single element with the label: the underlying Label and
 * FieldLabel primitives are `flex … gap-2`, so as a sibling the asterisk would sit 8px
 * off the word. It is aria-hidden because the control itself carries aria-required —
 * screen readers already announce the field as required, and "name star" is noise.
 */
export function LabelText({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span>
      {children}
      {!!required && <span aria-hidden="true">*</span>}
    </span>
  )
}
