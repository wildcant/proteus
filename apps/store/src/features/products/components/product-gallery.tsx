import { PackageIcon } from 'lucide-react'
import { useState } from 'react'
import type { StoreProductImage } from '#/api/generated/model'

type ProductGalleryProps = {
  images: StoreProductImage[]
  /** Opens the gallery on this image, and stands in as the only image when `images` is empty. */
  thumbnail: string | null
  alt: string
}

export function ProductGallery({ images, thumbnail, alt }: ProductGalleryProps) {
  const [activeImageId, setActiveImageId] = useState<string | null>(null)

  // Derived rather than synced: when the variant changes, the previously active id is no longer in
  // `images` and the new variant's thumbnail takes over. An image both variants share stays active.
  const active =
    images.find((image) => image.id === activeImageId) ?? images.find((image) => image.url === thumbnail) ?? images[0]
  const activeUrl = active?.url ?? thumbnail

  if (!activeUrl) {
    return (
      <div className="flex aspect-3/4 w-full items-center justify-center bg-(--bg-subtle) text-border">
        <PackageIcon className="h-16 w-16" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 lg:max-w-lg lg:flex-row">
      {images.length > 1 && (
        <ul className="order-2 flex gap-3 lg:order-1 lg:w-20 lg:flex-col">
          {images.map((image, index) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => setActiveImageId(image.id)}
                aria-current={image.url === activeUrl}
                aria-label={`Show image ${index + 1}`}
                className="block aspect-3/4 w-16 overflow-hidden bg-(--bg-subtle) opacity-55 -outline-offset-2 transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-foreground aria-current:opacity-100 lg:w-full"
              >
                <img src={image.url} alt="" className="h-full w-full object-cover" width={80} height={107} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="order-1 aspect-3/4 flex-1 overflow-hidden bg-(--bg-subtle) lg:order-2">
        {/* Keyed so a colourway change replays the fade instead of hard-swapping the photo. */}
        <img
          key={activeUrl}
          src={activeUrl}
          alt={alt}
          className="fade-in h-full w-full animate-in object-cover duration-300 motion-reduce:animate-none"
          fetchPriority="high"
          width={600}
          height={800}
        />
      </div>
    </div>
  )
}
