import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@proteus/ui'
import { useNavigate } from '@tanstack/react-router'
import { EllipsisIcon } from 'lucide-react'
import type { AdminCustomer } from '#/api/generated/model'
import { useDeleteCustomer } from '#/features/customers/api/customers'

export function CustomerRowActions({ customer }: { customer: AdminCustomer }) {
  const navigate = useNavigate()
  const { mutate: deleteCustomer } = useDeleteCustomer()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => navigate({ to: `/customers/${customer.id}/edit` })}>Edit</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => deleteCustomer({ id: customer.id })}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
