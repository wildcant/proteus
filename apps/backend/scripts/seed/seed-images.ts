import path from 'node:path'

/** The committed photos for the catalogue in `product-import.csv`. See its README for provenance. */
export const SEED_IMAGE_DIR = path.join(import.meta.dirname, '..', '..', 'seed-images')

/**
 * The file in `SEED_IMAGE_DIR` holding the photo a CSV image URL names. mock.shop's CDN names each
 * photo by its content hash, so the URL's last segment is already unique and stable.
 */
export function seedImageFile(url: string): string {
  const file = path.posix.basename(new URL(url).pathname)
  if (!file) throw new Error(`Image URL "${url}" names no file`)
  return file
}
