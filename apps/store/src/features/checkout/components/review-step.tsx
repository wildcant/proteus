import { Button } from '#/components/button'
import { useReviewStep } from '#/features/checkout/hooks/use-review-step'

export function ReviewStep() {
  const { handlePlaceOrder, isPending, error } = useReviewStep()

  return (
    <div>
      <p className="text-sm text-(--foreground-muted)">
        By placing this order, you agree to our terms of service and privacy policy.
      </p>

      <Button onClick={handlePlaceOrder} disabled={isPending} className="mt-6">
        {isPending ? 'Placing order...' : 'Place order'}
      </Button>

      {error ? <p className="mt-2 text-sm text-red-600">{error.message}</p> : null}
    </div>
  )
}
