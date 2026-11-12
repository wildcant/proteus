import type { StoreProductCollection } from '#/api/generated/model'

/**
 * The collection page's banner under its title: the merchant's thumbnail, full width. A Collection
 * without one shows nothing here, so the title alone leads into the list.
 */
export function CollectionHero({ collection }: { collection: StoreProductCollection }) {
  if (!collection.thumbnail) return null

  return (
    // `mt-2` on top of the header intro slot's `gap-4`: 24px under the title, as before the slot.
    <div className="mt-2 aspect-4/3 overflow-hidden bg-surface-subtle sm:aspect-21/9">
      <img
        src={collection.thumbnail}
        alt={collection.title}
        className="h-full w-full object-cover"
        // Above the fold on every width, so it competes for nothing and should land first.
        fetchPriority="high"
      />
    </div>
  )
}
