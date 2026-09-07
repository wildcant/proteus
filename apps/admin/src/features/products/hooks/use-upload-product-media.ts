import type { ProductMedia } from '#/features/products/utils/media'
import { useUploadFiles } from '#/features/uploads/api/uploads'

/**
 * Uploads the files staged in a media list and swaps their blob preview URLs for storage URLs.
 * Media that is already persisted passes through untouched.
 */
export function useUploadProductMedia() {
  const uploadMutation = useUploadFiles()

  const uploadMedia = async (media: ProductMedia[]): Promise<ProductMedia[]> => {
    const staged = media.flatMap((item) => (item.file ? [{ key: item.key, file: item.file }] : []))

    if (!staged.length) {
      return media
    }

    const { files } = await uploadMutation.mutateAsync({ files: staged.map((item) => item.file) })

    // Guard rather than fall back to the blob URL — a blob URL is dead the moment the page
    // unloads, so persisting one would leave the product with a permanently broken image.
    if (files.length !== staged.length) {
      throw new Error('The upload returned an unexpected number of files')
    }

    const uploadedUrls = new Map(staged.map((item, index) => [item.key, files[index]?.url]))

    return media.map((item) => ({ ...item, url: uploadedUrls.get(item.key) ?? item.url }))
  }

  return { uploadMedia, isPending: uploadMutation.isPending }
}
