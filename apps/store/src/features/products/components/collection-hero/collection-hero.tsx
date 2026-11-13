import { cn } from '@proteus/ui-core'
import type { StoreProductCollection } from '#/api/generated/model'
import {
  collectionHero,
  collectionHeroImage,
} from '#/features/products/components/collection-hero/collection-hero.variants'

/**
 * The collection page's banner under its title: the merchant's thumbnail, full width. A Collection
 * without one shows nothing here, so the title alone leads into the list.
 */
export function CollectionHero({ collection, className }: { collection: StoreProductCollection; className?: string }) {
  if (!collection.thumbnail) return null

  return (
    // The banner's height follows its width (`components.runtimeSizes`); the photograph is data.
    <div className={cn(collectionHero(), 'aspect-4/3 sm:aspect-21/9', className)}>
      <img
        src={collection.thumbnail}
        alt={collection.title}
        className={cn(collectionHeroImage(), 'min-h-0 w-full object-cover')}
        // Above the fold on every width, so it competes for nothing and should land first.
        fetchPriority="high"
      />
    </div>
  )
}
