import { cn } from '@proteus/ui-core'
import type { ReactNode } from 'react'
import {
  checkoutSection,
  checkoutSectionAction,
  checkoutSectionBody,
  checkoutSectionHeader,
  checkoutSectionTitle,
} from '#/features/checkout/components/checkout-section/checkout-section.variants'

type CheckoutSectionProps = {
  title: string
  /** Right-hand slot on the title row — the Sign in link, and nothing else so far. */
  action?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * One block of the one-page checkout, separated by space rather than rules — the form's gap, not
 * a border here. No `isOpen` / `isComplete` / `onEdit` like the old `CheckoutStep`: none of the
 * three means anything once every section is visible at once. No description slot either.
 */
export function CheckoutSection({ title, action, children, className }: CheckoutSectionProps) {
  return (
    <section className={cn(checkoutSection(), className)}>
      <div className={checkoutSectionHeader()}>
        <h2 className={cn(checkoutSectionTitle(), 'm-0')}>{title}</h2>
        {action ? <div className={checkoutSectionAction()}>{action}</div> : null}
      </div>
      <div className={checkoutSectionBody()}>{children}</div>
    </section>
  )
}
