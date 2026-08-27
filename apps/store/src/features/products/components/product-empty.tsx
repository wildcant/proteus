import { Button } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { PackageIcon } from 'lucide-react'

/**
 * Replaces the grid rather than following it — an empty result set used to paint an empty grid
 * element above the message.
 *
 * Two branches, because "nothing matched what you typed" and "there is nothing here" are different
 * facts and only the first has anything to clear.
 */
export function ProductEmpty({ q }: { q?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <PackageIcon className="size-8 text-ink-subtle" strokeWidth={1.5} />
      {q ? (
        <>
          {/* The header search panel's own phrasing, so the same miss reads the same either way. */}
          <p className="mt-6 max-w-70 text-ink-muted text-sm">No products match &ldquo;{q}&rdquo;.</p>
          <Button render={<Link to="/" />} className="mt-8">
            Clear search
          </Button>
        </>
      ) : (
        <p className="mt-6 max-w-70 text-ink-muted text-sm">No products yet.</p>
      )}
    </div>
  )
}
