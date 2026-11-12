import { Trans } from '@lingui/react/macro'
import { Badge, ButtonLink, Card, CardAction, CardHeader, CardTitle } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { ChevronRightIcon } from 'lucide-react'
import type { AdminProductCategoryTreeNode } from '#/api/generated/model'
import { flattenCategoryTree } from '#/features/categories/utils/flatten-category-tree'

/**
 * Every Category as an indented tree, siblings in rank order. Not a DataTable: the tree is one
 * unpaginated response, and its order is the tree's, not a sortable column.
 */
export function CategoryTreeList({ categories }: { categories: AdminProductCategoryTreeNode[] }) {
  const rows = flattenCategoryTree(categories)

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader className="py-4">
        <CardTitle>
          <Trans>Categories</Trans>
        </CardTitle>
        <CardAction className="flex items-center gap-x-2">
          <ButtonLink to="/categories/organize" variant="outline" size="sm">
            <Trans>Organize</Trans>
          </ButtonLink>
          <ButtonLink to="/categories/create" variant="outline" size="sm">
            <Trans>Create</Trans>
          </ButtonLink>
        </CardAction>
      </CardHeader>
      {rows.length === 0 ? (
        <p className="px-6 py-8 text-center text-muted-foreground text-sm">
          <Trans>No categories yet. Create one to start the tree.</Trans>
        </p>
      ) : (
        <ul className="divide-y">
          {rows.map(({ category, depth }) => (
            <li key={category.id}>
              <Link
                to="/categories/$id"
                params={{ id: category.id }}
                className="flex items-center gap-x-3 py-3 pr-6 text-sm hover:bg-muted/50"
                // Indentation is the tree; a fixed step per level keeps siblings aligned.
                style={{ paddingLeft: `${1.5 + depth * 1.5}rem` }}
              >
                {depth > 0 && <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
                <span className="font-medium">{category.name}</span>
                <span className="truncate text-muted-foreground">{category.handle}</span>
                <span className="ml-auto flex shrink-0 gap-x-2">
                  {category.isActive ? (
                    <Badge variant="secondary">
                      <Trans>Active</Trans>
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <Trans>Inactive</Trans>
                    </Badge>
                  )}
                  {!!category.isInternal && (
                    <Badge variant="outline">
                      <Trans>Internal</Trans>
                    </Badge>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
