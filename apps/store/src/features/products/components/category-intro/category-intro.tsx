import { cn } from '@proteus/ui-core'
import { Link } from '@tanstack/react-router'
import type { StoreProductCategoryTreeNode } from '#/api/generated/model'
import {
  categoryIntro,
  categoryIntroChild,
  categoryIntroChildren,
} from '#/features/products/components/category-intro/category-intro.variants'
import { TagChip } from '#/features/products/components/tag-chip/tag-chip'

/**
 * What sits under a category page's heading: its description, then a chip per Visible child in
 * rank order. Each chip is a plain link, so the shopper's search, sort and page stay behind.
 */
export function CategoryIntro({ category }: { category: StoreProductCategoryTreeNode }) {
  if (!category.description && category.children.length === 0) return null

  return (
    <div className={categoryIntro()}>
      {/* Not drawn yet (no seeded category has a description), so its look stays here. */}
      {category.description ? <p className="m-0 max-w-160 text-ink-muted">{category.description}</p> : null}
      {category.children.length > 0 ? (
        <ul className={cn(categoryIntroChildren(), 'm-0 list-none p-0')}>
          {category.children.map((child) => (
            <li key={child.id} className={categoryIntroChild()}>
              <TagChip render={<Link to="/categories/$handle" params={{ handle: child.handle }} />}>
                {child.name}
              </TagChip>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
