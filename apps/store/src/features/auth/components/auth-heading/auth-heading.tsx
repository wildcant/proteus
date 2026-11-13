import { cn } from '@proteus/ui-core'
import type { ReactNode } from 'react'
import {
  authHeading,
  authHeadingDescription,
  authHeadingTitle,
} from '#/features/auth/components/auth-heading/auth-heading.variants'

/**
 * Title and supporting line for an auth page. Shared so /login, /signup and the
 * check-your-email state stay typographically identical.
 */
export function AuthHeading({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn(authHeading(), className)}>
      <h1 className={authHeadingTitle()}>{title}</h1>
      <p className={authHeadingDescription()}>{children}</p>
    </div>
  )
}
