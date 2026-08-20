import { Button } from '@proteus/ui'
import { UpdateCustomerForm } from '#/features/customers/components/update-customer-form.tsx'
import { useCustomerList } from '#/features/customers/hooks/use-customer-list.ts'
import { useDeleteCustomer } from '../api/customers'

export function CustomerList() {
  const { customers, count, limit, offset, setOffset, editingId, setEditingId } = useCustomerList()
  const deleteCustomer = useDeleteCustomer()

  return (
    <>
      <div className="space-y-3">
        {customers.map((customer) => (
          <div key={customer.id} className="island-shell flex items-center justify-between rounded-xl p-4">
            {editingId === customer.id ? (
              <UpdateCustomerForm defaultValues={customer} id={customer.id} onSettled={() => setEditingId(null)} />
            ) : (
              <>
                <div>
                  <p className="font-semibold text-(--sea-ink)">
                    {customer.firstName} {customer.lastName}
                  </p>
                  <p className="text-(--sea-ink-soft) text-sm">{customer.email}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(customer.id)}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteCustomer.mutate({ id: customer.id })}
                  >
                    Delete
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
        {customers.length === 0 && (
          <p className="text-center text-(--sea-ink-soft) text-sm">No customers yet. Add one above.</p>
        )}
      </div>

      {count > 0 && (
        <div className="mt-6 flex items-center justify-between text-(--sea-ink-soft) text-sm">
          <span>
            Showing {offset + 1}–{Math.min(offset + limit, count)} of {count}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={offset + limit >= count}
              onClick={() => setOffset(offset + limit)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
