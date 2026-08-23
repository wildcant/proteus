/** Only the fields a swatch is resolved from, so the caller can pass its response projection. */
type SwatchOption = { id: string; values: ReadonlyArray<{ id: string }> }
type SwatchVariant = { optionValues: Readonly<Record<string, string>>; imageIds: readonly string[] }

/**
 * The image each option value shows as a swatch: the first image of the first variant carrying it.
 *
 * Resolved server-side because it does not depend on what the shopper has selected — the same
 * reason `buildPickerTargets` is precomputed rather than worked out in the storefront. Keyed by
 * value id, which is unique across options, so one flat map serves every option.
 *
 * Takes the variants the caller is actually shipping: a value whose only carrier was dropped for
 * having no price falls back to `null` rather than pointing at an image the response never sent.
 */
export function buildOptionSwatches(
  options: readonly SwatchOption[],
  variants: readonly SwatchVariant[],
  images: ReadonlyArray<{ id: string; url: string }>,
): Record<string, string | null> {
  const imageUrlById = new Map(images.map((image) => [image.id, image.url]))

  return Object.fromEntries(
    options.flatMap((option) =>
      option.values.map((value) => {
        const carrier = variants.find((variant) => variant.optionValues[option.id] === value.id)
        const imageId = carrier?.imageIds[0]
        return [value.id, imageId ? (imageUrlById.get(imageId) ?? null) : null]
      }),
    ),
  )
}
