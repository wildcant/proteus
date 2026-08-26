import { createFileRoute } from '@tanstack/react-router'
import { StoreDrawer } from '#/components/store-drawer'
import { CreateAddressForm } from '#/features/address/components/create-address-form'

export const Route = createFileRoute('/_checkout/checkout/addresses/new')({
  component: () => (
    <StoreDrawer prev="/checkout">
      <CreateAddressForm />
    </StoreDrawer>
  ),
})
