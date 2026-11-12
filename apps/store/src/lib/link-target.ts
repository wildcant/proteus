import type { AnyRouter, LinkOptions } from '@tanstack/react-router'

/**
 * Where a link or a navigation goes, as a route hands it down from the flow map (`src/navigation/links.ts`). Opaque
 * below the routes: a component spreads it on `<Link>` or passes it to `navigate`, and never builds one, so it never
 * knows the route tree.
 */
export type LinkTarget = LinkOptions<AnyRouter, string, string>
