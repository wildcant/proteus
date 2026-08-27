import type { ReactNode } from 'react'

/**
 * Label text with an optional required marker.
 *
 * The marker is a `::after` pseudo-element rather than a text node. It has to share a single
 * element with the label — the underlying Label and FieldLabel primitives are `flex … gap-2`, so
 * as a sibling the asterisk would sit 8px off the word — and it must stay out of the label's text
 * content, which an `aria-hidden` span does not achieve: accessible-name computation honours
 * `aria-hidden`, but `textContent` and Playwright's `getByLabel` do not, so the label read as
 * "Address*" and no exact selector could match it.
 *
 * The control carries `aria-required`, so screen readers announce the field as required without
 * the marker being announced as "star".
 */
export function LabelText({ children, required }: { children: ReactNode; required?: boolean }) {
  return <span className={required ? "after:content-['*']" : undefined}>{children}</span>
}
