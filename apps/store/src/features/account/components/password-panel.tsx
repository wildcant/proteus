import { Button } from '#/components/button'
import { AccountPanel } from '#/features/account/components/account-panel'
import { useRequestPasswordReset } from '#/features/auth/api/auth'

/**
 * No form: the signed-in customer's email is already known, so the panel is one action that
 * sends the same link `/forgot-password` sends and then says so in place. There is no
 * update-password-while-signed-in endpoint, and the emailed link is the flow Shopify uses too.
 */
export function PasswordPanel({ email }: { email: string }) {
  const requestReset = useRequestPasswordReset()

  return (
    <AccountPanel title="Password" description="We email you a link rather than asking for your current password.">
      {requestReset.isSuccess ? (
        <p className="mt-6 text-ink text-sm">
          Reset link sent to <span className="font-semibold">{email}</span>. Check your inbox.
        </p>
      ) : (
        <Button
          variant="link"
          className="mt-6 self-start"
          disabled={requestReset.isPending}
          onClick={() => requestReset.mutate({ email })}
        >
          {requestReset.isPending ? 'Sending...' : 'Send a reset link'}
        </Button>
      )}
    </AccountPanel>
  )
}
