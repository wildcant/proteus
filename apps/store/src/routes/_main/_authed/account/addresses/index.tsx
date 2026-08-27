import { createFileRoute } from '@tanstack/react-router'

// The page itself lives on the layout route above; this exists so `/account/addresses` has a
// leaf to match, and renders nothing over it.
export const Route = createFileRoute('/_main/_authed/account/addresses/')({
  component: () => null,
})
