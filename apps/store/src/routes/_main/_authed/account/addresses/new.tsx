import { createFileRoute } from '@tanstack/react-router'
import { StoreDrawer } from '#/components/store-drawer'
import { CreateAddressForm } from '#/features/address/components/create-address-form'

export const Route = createFileRoute('/_main/_authed/account/addresses/new')({
  component: () => (
    <StoreDrawer>
      <CreateAddressForm />
    </StoreDrawer>
  ),
})
