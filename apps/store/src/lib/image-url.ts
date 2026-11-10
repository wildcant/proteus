import { env } from '#/env'

const LARGEST_WIDTH = 1200

/**
 * The only widths `/img/…` produces. A fixed set caps each photo at five variants, which keeps
 * transforms inside the Images free allowance and stops anyone from minting new ones by asking
 * for arbitrary sizes. 1200 is the size photos are uploaded at, so it is the largest worth making.
 */
export const IMAGE_WIDTHS = [320, 480, 640, 960, LARGEST_WIDTH] as const

/** `/img/w640/images/seed/photo.jpg` → width 640, bucket key `images/seed/photo.jpg`. */
export const IMAGE_PATH = /^\/img\/w(\d+)\/(.+)$/

/**
 * `src`, `srcSet` and `sizes` for a stored photo, pointing at the store's own resizing route so the
 * browser downloads the width the layout needs, in the best format it accepts.
 *
 * Photos outside the bucket are returned untouched. In local development they live in MinIO, which
 * the route cannot read, so `VITE_IMAGE_ORIGIN` is unset there and every photo takes this branch.
 */
export function responsiveImage(url: string, sizes: string) {
  const origin = env.VITE_IMAGE_ORIGIN
  if (!origin || !url.startsWith(`${origin}/`)) return { src: url }

  const key = url.slice(origin.length + 1)
  const at = (width: number) => `/img/w${width}/${key}`
  return {
    src: at(LARGEST_WIDTH),
    srcSet: IMAGE_WIDTHS.map((width) => `${at(width)} ${width}w`).join(', '),
    sizes,
  }
}
