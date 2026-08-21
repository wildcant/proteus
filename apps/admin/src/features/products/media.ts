import { AdminUpsertProductImage } from '@proteus/http-schemas/admin'
import { z } from 'zod'
import type { AdminProductResponseProduct } from '#/api/generated/model'

/**
 * A product image while it is being edited. Media dropped into the upload zone stays a local
 * `File` with a blob preview URL until the form is submitted, so both staged and already
 * persisted images can sit in the same ordered list.
 */
export type ProductMedia = {
  /** Stable identity for list keys and drag-and-drop. Unrelated to the persisted image id. */
  key: string
  /** The persisted product image id. Absent until the media has been saved. */
  id?: string
  url: string
  isThumbnail: boolean
  file: File | null
}

/**
 * Validator for a `media` form field: the image payload the API accepts, plus the fields that
 * only exist while staging. The `File` is what keeps this shape client-only — it is the reason
 * the field cannot just be the API's image schema.
 */
export const mediaSchema = z.array(
  AdminUpsertProductImage.extend({
    key: z.string(),
    isThumbnail: z.boolean(),
    file: z.instanceof(File).nullable(),
  }),
) satisfies z.ZodType<ProductMedia[]>

/**
 * A product can carry a thumbnail URL that is not part of its image collection. It is surfaced
 * first and without an id, so saving the form promotes it to a real image.
 */
export function getProductMedia({ images, thumbnail }: AdminProductResponseProduct): ProductMedia[] {
  const media: ProductMedia[] = (images ?? []).map((image) => ({
    key: image.id,
    id: image.id,
    url: image.url,
    isThumbnail: image.url === thumbnail,
    file: null,
  }))

  if (thumbnail && !media.some((item) => item.url === thumbnail)) {
    media.unshift({ key: thumbnail, url: thumbnail, isThumbnail: true, file: null })
  }

  return media
}

/**
 * Shapes an ordered media list into the `images` + `thumbnail` pair both the create and update
 * product endpoints expect. Array order becomes image rank, and the collection replaces
 * whatever the product had.
 *
 * Expects storage URLs — run the list through `useUploadProductMedia` first, or the blob URLs
 * of any staged file will be persisted.
 */
export function resolveMediaPayload(media: ProductMedia[]) {
  return {
    images: media.map((item) => ({ id: item.id, url: item.url })),
    thumbnail: media.find((item) => item.isThumbnail)?.url ?? null,
  }
}
