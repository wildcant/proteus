import { Link } from '@tanstack/react-router'
import type { StoreProductCategoryTreeNode } from '#/api/generated/model'

/**
 * What sits under a category page's heading: its description, then a chip per Visible child in
 * rank order. Each chip is a plain link, so the shopper's search, sort and page stay behind.
 */
export function CategoryIntro({ category }: { category: StoreProductCategoryTreeNode }) {
  if (!category.description && category.children.length === 0) return null

  return (
    <div className="mt-4 flex flex-col gap-5">
      {category.description ? <p className="m-0 max-w-160 text-ink-muted">{category.description}</p> : null}
      {category.children.length > 0 ? (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {category.children.map((child) => (
            <li key={child.id}>
              <Link
                to="/categories/$handle"
                params={{ handle: child.handle }}
                className="flex h-10 items-center border border-line px-4 text-ink text-sm no-underline hover:border-ink"
              >
                {child.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
