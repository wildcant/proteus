import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { Panel } from '#/components/store/panel/panel'
import { Button } from '#/components/ui/button/button'
import { useRequestPasswordReset } from '#/entities/customer/api/auth'
import {
  passwordPanel,
  passwordPanelAction,
  passwordPanelPanel,
  passwordPanelSendLink,
} from '#/features/account/components/password-panel/password-panel.variants'

/**
 * No form: the signed-in customer's email is already known, so the panel is one action that
 * sends the same link `/forgot-password` sends and then says so in place. There is no
 * update-password-while-signed-in endpoint, and the emailed link is the flow Shopify uses too.
 */
export function PasswordPanel({ email, className }: { email: string; className?: string }) {
  const { t } = useLingui()
  const requestReset = useRequestPasswordReset()

  return (
    <Panel
      title={t`Password`}
      description={t`We email you a link rather than asking for your current password.`}
      className={cn(passwordPanel(), passwordPanelPanel(), className)}
    >
      <div className={passwordPanelAction()}>
        {requestReset.isSuccess ? (
          // Not drawn: the sent line replaces the action once the link is on its way.
          <p className="text-ink text-sm">
            <Trans>
              Reset link sent to <span className="font-semibold">{email}</span>. Check your inbox.
            </Trans>
          </p>
        ) : (
          <Button
            variant="link"
            className={passwordPanelSendLink()}
            disabled={requestReset.isPending}
            onClick={() => requestReset.mutate({ email })}
          >
            {requestReset.isPending ? t`Sending...` : t`Send a reset link`}
          </Button>
        )}
      </div>
    </Panel>
  )
}
