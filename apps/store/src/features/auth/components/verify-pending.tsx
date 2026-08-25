import { Link } from '@tanstack/react-router'
import { Button } from '#/components/button'
import { AuthHeading } from '#/features/auth/components/auth-heading'

/** Shown after signing up, or signing in to an account that has not confirmed its email yet. */
export function VerifyPending() {
  return (
    <>
      <AuthHeading title="Check your email">
        We sent a verification link to your email. Click it to confirm your account, then come back and sign in.
      </AuthHeading>
      <Button variant="outline" render={<Link to="/login" />} className="mt-10 h-14 w-full font-semibold text-base">
        Back to sign in
      </Button>
    </>
  )
}
