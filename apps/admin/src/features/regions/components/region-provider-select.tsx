import { Trans, useLingui } from '@lingui/react/macro'
import { MultiSelectCombobox } from '#/components/multi-select-combobox'
import { usePaymentProviders } from '#/features/regions/api/payment-providers'
import { paymentProviderLabel } from '#/features/regions/utils/payment-provider-label'

type RegionProviderSelectProps = {
  value: string[]
  onChange: (paymentProviderIds: string[]) => void
}

/** Which gateways the region takes payment through. The list is the enabled providers. */
export function RegionProviderSelect({ value, onChange }: RegionProviderSelectProps) {
  const { t } = useLingui()
  const { data } = usePaymentProviders()
  const items = (data?.paymentProviders ?? []).map((provider) => ({
    id: provider.id,
    label: paymentProviderLabel(provider.id),
  }))

  return (
    <div>
      <h2 className="font-medium text-sm">
        <Trans>Providers</Trans>
      </h2>
      <p className="mb-3 text-muted-foreground text-sm">
        <Trans>Add which payment providers are available in this region.</Trans>
      </p>
      <MultiSelectCombobox
        items={items}
        value={value}
        onValueChange={onChange}
        placeholder={t`Search payment providers...`}
        emptyMessage={t`No payment providers found.`}
      />
    </div>
  )
}
