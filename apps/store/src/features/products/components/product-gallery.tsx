import { cn } from '@proteus/ui'
import { PackageIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { StoreProductImage } from '#/api/generated/model'
import { GalleryDots } from '#/features/products/components/gallery-dots'

type ProductGalleryProps = {
  images: StoreProductImage[]
  /** Opens the gallery on this image, and stands in as the only image when `images` is empty. */
  thumbnail: string | null
  alt: string
  /** Returns the strip to the variant's own photo when the colourway changes. */
  variantId: string | undefined
}

/**
 * Every photo, in one list, laid out two ways.
 *
 * Below `lg` it is a full-bleed horizontal snap carousel — one slide per viewport, the dot row
 * underneath carrying both the length and the random access the deleted thumbnail rail used to
 * provide. At `lg` the same list becomes a `[half, half, full]` mosaic, which shows everything at
 * once and leaves the dots nothing to indicate.
 */
export function ProductGallery({ images, thumbnail, alt, variantId }: ProductGalleryProps) {
  const scroller = useRef<HTMLUListElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const isMosaic = useIsMosaic()

  // `thumbnail` does two jobs. The obvious one is standing in when the product has no images at
  // all; the load-bearing one is opening the gallery on the *variant's* photo, which matters
  // precisely when the variant carries no image links and the page falls back to the whole product
  // gallery. Without it a red variant would open on the black variant's first shot.
  const slides = images.length > 0 ? images : thumbnail ? [{ id: thumbnail, url: thumbnail }] : []
  const initialIndex = Math.max(
    slides.findIndex((image) => image.url === thumbnail),
    0,
  )

  // Scroll position cannot be expressed in the markup, so the opening slide is an effect. Keyed on
  // the variant rather than on the index so a colourway change re-runs it even when both
  // colourways happen to open on the same position.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the variant is the trigger, the index is the value
  useEffect(() => {
    const element = scroller.current
    if (!element) return
    element.scrollTo({ left: initialIndex * element.clientWidth, behavior: 'instant' })
    setActiveIndex(initialIndex)
  }, [variantId])

  if (slides.length === 0) {
    return (
      <div className="flex aspect-4/5 w-full items-center justify-center bg-surface-subtle text-line">
        <PackageIcon className="size-16" />
      </div>
    )
  }

  const showSlide = (index: number) => {
    const element = scroller.current
    if (!element) return
    element.scrollTo({ left: index * element.clientWidth, behavior: 'smooth' })
  }

  return (
    <div className="flex flex-col gap-2">
      <ul
        ref={scroller}
        // A scrollable region has to be reachable by keyboard — the dots alone do not make it so,
        // and arrow-key scrolling is the only way through the strip without a pointer. The mosaic
        // scrolls nothing, so up there the same stop would land focus on a grid with nowhere to go.
        tabIndex={isMosaic ? undefined : 0}
        aria-label={`${alt} images`}
        onScroll={(event) => {
          const { scrollLeft, clientWidth } = event.currentTarget
          if (clientWidth === 0) return
          setActiveIndex(Math.round(scrollLeft / clientWidth))
        }}
        className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto -outline-offset-2 focus-visible:outline focus-visible:outline-ink lg:grid lg:grid-cols-2 lg:gap-1 lg:overflow-visible"
      >
        {slides.map((image, index) => (
          <li
            key={image.id}
            className={cn(
              'w-full shrink-0 snap-start bg-surface-subtle lg:w-auto',
              // The mosaic's rhythm: every third image spans both columns, and so does a trailing
              // image that would otherwise sit alone in the left one. No count leaves an orphan.
              (index % 3 === 2 || (index === slides.length - 1 && index % 3 === 0)) && 'lg:col-span-2',
            )}
          >
            <img
              src={image.url}
              // No alt column on the image, so the honest fallback is positional. Every slide is
              // content here, unlike the thumbnails it replaces, which were navigation.
              alt={`${alt} — view ${index + 1} of ${slides.length}`}
              className="aspect-4/5 w-full object-cover"
              fetchPriority={index === 0 ? 'high' : undefined}
              loading={index === 0 ? undefined : 'lazy'}
              width={720}
              height={900}
            />
          </li>
        ))}
      </ul>

      <GalleryDots count={slides.length} activeIndex={activeIndex} onSelect={showSlide} />
    </div>
  )
}

/** Tailwind's `lg`, the width at which the carousel becomes the mosaic. */
const MOSAIC_QUERY = '(min-width: 64rem)'

/**
 * Whether the list is laid out as the mosaic rather than the carousel.
 *
 * `tabIndex` is an attribute, so unlike everything else here the two layouts cannot be told apart
 * in CSS — the one thing on this component that has to know the viewport in JavaScript.
 *
 * Starts `false` on purpose: the route is server-rendered, and a carousel that is keyboard-reachable
 * in the server's HTML degrades safely if the effect never runs, where the reverse strands the
 * strip. It also means the first client render matches what the server sent, and the correction to
 * the mosaic happens after mount.
 */
function useIsMosaic() {
  const [isMosaic, setIsMosaic] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(MOSAIC_QUERY)
    const sync = () => setIsMosaic(media.matches)

    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return isMosaic
}
