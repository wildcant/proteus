import { useUploadFiles } from '#/features/uploads/api/uploads'

/** The thumbnail as the form holds it: a stored URL, or a picked file not uploaded yet with its blob preview. */
export type CollectionThumbnail = { url: string; file?: File }

/** Uploads a picked thumbnail and answers its storage URL. A stored one passes through untouched. */
export function useUploadCollectionThumbnail() {
  const uploadMutation = useUploadFiles()

  const uploadThumbnail = async (thumbnail: CollectionThumbnail | null): Promise<string | null> => {
    if (!thumbnail) return null
    if (!thumbnail.file) return thumbnail.url

    const { files } = await uploadMutation.mutateAsync({ files: [thumbnail.file] })
    // Never fall back to the blob URL: it is dead the moment the page unloads.
    const url = files[0]?.url
    if (!url) throw new Error('The upload returned no file')
    return url
  }

  return { uploadThumbnail }
}
