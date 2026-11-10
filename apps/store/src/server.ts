import { env as bindings } from 'cloudflare:workers'
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { env } from '#/env'
import { IMAGE_PATH, IMAGE_WIDTHS } from '#/lib/image-url'

const ONE_YEAR = 60 * 60 * 24 * 365

/** AVIF where the browser takes it, WebP as the next best, JPEG for the rest. */
function formatFor(accept: string | null) {
  if (accept?.includes('image/avif')) return 'image/avif'
  if (accept?.includes('image/webp')) return 'image/webp'
  return 'image/jpeg'
}

/**
 * One photo at one width. The response is cached for a year by Workers Cache and by the browser, so
 * a given width is transformed once rather than per visitor. Bucket keys are timestamped on upload
 * and never rewritten, which is what makes `immutable` safe.
 */
async function serveImage(request: Request, width: number, key: string) {
  const object = await bindings.ASSETS_BUCKET.get(key)
  if (!object) return new Response('Not found', { status: 404 })

  try {
    const result = await bindings.IMAGES.input(object.body)
      .transform({ width, fit: 'scale-down' })
      .output({ format: formatFor(request.headers.get('accept')), quality: 80 })
    return result.response({
      headers: { 'cache-control': `public, max-age=${ONE_YEAR}, immutable`, vary: 'Accept' },
    })
  } catch (error) {
    // Past the monthly transform allowance the binding fails (code 9422) rather than billing.
    // The original is still a valid photo, just a heavier one.
    // `info` because it is the channel this repo allows; see sellable-markets.ts.
    console.info('[image] transform failed, serving the original', key, error)
    return new Response(null, {
      status: 302,
      headers: { location: `${env.VITE_IMAGE_ORIGIN}/${key}`, 'cache-control': 'no-store' },
    })
  }
}

/**
 * The Worker's entry. `/img/…` is answered here, ahead of TanStack Start, because it is not a page:
 * the market middleware would otherwise redirect it to a market-prefixed URL.
 */
export default createServerEntry({
  fetch(request, options) {
    const match = IMAGE_PATH.exec(new URL(request.url).pathname)
    const width = Number(match?.[1])
    if (match?.[2] && IMAGE_WIDTHS.some((allowed) => allowed === width)) {
      return serveImage(request, width, decodeURIComponent(match[2]))
    }
    return handler.fetch(request, options)
  },
})
