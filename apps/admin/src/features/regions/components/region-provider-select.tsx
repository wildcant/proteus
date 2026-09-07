import { MultiSelectCombobox } from '#/components/multi-select-combobox'
import { usePaymentProviders } from '#/features/regions/api/payment-providers'
import { paymentProviderLabel } from '#/features/regions/utils/payment-provider-label'

type RegionProviderSelectProps = {
  value: string[]
  onChange: (paymentProviderIds: string[]) => void
}

/** Which gateways the region takes payment through. The list is the enabled providers. */
export function RegionProviderSelect({ value, onChange }: RegionProviderSelectProps) {
  const { data } = usePaymentProviders()
  const items = (data?.paymentProviders ?? []).map((provider) => ({
    id: provider.id,
    label: paymentProviderLabel(provider.id),
  }))

  return (
    <div>
      <h2 className="font-medium text-sm">Providers</h2>
      <p className="mb-3 text-muted-foreground text-sm">Add which payment providers are available in this region.</p>
      <MultiSelectCombobox
        items={items}
        value={value}
        onValueChange={onChange}
        placeholder="Search payment providers..."
        emptyMessage="No payment providers found."
      />
    </div>
  )
}
