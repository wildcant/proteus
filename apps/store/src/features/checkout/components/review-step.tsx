import { Button } from '#/components/button'
import { useReviewStep } from '#/features/checkout/hooks/use-review-step'

export function ReviewStep() {
  const { handlePlaceOrder, isPending, error } = useReviewStep()

  return (
    <div>
      <p className="text-(--foreground-muted) text-sm">
        By placing this order, you agree to our terms of service and privacy policy.
      </p>

      <Button onClick={handlePlaceOrder} className="mt-6">
        {isPending ? 'Placing order...' : 'Place order'}
      </Button>

      {error ? <p className="mt-2 text-red-600 text-sm">{error.message}</p> : null}
    </div>
  )
}
