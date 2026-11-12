import { Trans, useLingui } from '@lingui/react/macro'
import { Badge, Button, Checkbox, Input, Popover, PopoverContent, PopoverTrigger } from '@proteus/ui'
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminProductCategoryTreeNode } from '#/api/generated/model'
import { categoryPath, flattenCategoryTree } from '#/features/categories/utils/flatten-category-tree'

/** Several Categories — a product's — or at most one — a Category's parent. */
type CategoryPickerSelection =
  | { multiple: true; value: string[]; onValueChange: (categoryIds: string[]) => void }
  | { multiple: false; value: string | null; onValueChange: (categoryId: string | null) => void }

type CategoryPickerProps = CategoryPickerSelection & {
  /** The whole tree, loaded once — a shop has tens of Categories. */
  tree: AdminProductCategoryTreeNode[]
  id?: string
  'aria-invalid'?: boolean
  /** Leaves the other Categories browsable but not choosable. */
  canChoose?: (category: AdminProductCategoryTreeNode) => boolean
}

/**
 * Picks Categories from the tree.
 *
 * Browsing drills down one level at a time; typing switches to a flat list of matches across the
 * whole tree, each with its path ("Tops in Men"), because names repeat between branches. Choosing
 * in single mode replaces the choice and closes the list.
 */
export function CategoryPicker({
  tree,
  id,
  'aria-invalid': ariaInvalid,
  canChoose = () => true,
  ...selection
}: CategoryPickerProps) {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [trail, setTrail] = useState<AdminProductCategoryTreeNode[]>([])

  const flat = useMemo(() => flattenCategoryTree(tree), [tree])
  const byId = useMemo(() => new Map(flat.map((row) => [row.category.id, row])), [flat])
  const value = selection.multiple ? selection.value : selection.value ? [selection.value] : []
  const selected = new Set(value)

  const toggle = (categoryId: string) => {
    if (selection.multiple) {
      selection.onValueChange(
        selected.has(categoryId) ? value.filter((id) => id !== categoryId) : [...value, categoryId],
      )
      return
    }
    selection.onValueChange(selected.has(categoryId) ? null : categoryId)
    setOpen(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) return
    setQuery('')
    setTrail([])
  }

  const current = trail.at(-1)
  const level = current ? current.children : tree
  const search = query.trim().toLocaleLowerCase()
  const matches = search ? flat.filter((row) => row.category.name.toLocaleLowerCase().includes(search)) : []

  return (
    <div className="flex flex-col gap-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((categoryId) => {
            const row = byId.get(categoryId)
            // A Category deleted since the form was loaded is not in the tree; it is dropped on save.
            if (!row) return null
            // The path, as everywhere a chosen Category is shown: two "Sweatshirts" chips would be
            // indistinguishable.
            const name = categoryPath(row)
            return (
              <li key={categoryId}>
                <Badge variant="secondary" className="gap-1 pr-0.5">
                  {name}
                  <button
                    type="button"
                    className="rounded-sm opacity-70 hover:opacity-100"
                    aria-label={t`Remove ${name}`}
                    onClick={() => toggle(categoryId)}
                  >
                    <XIcon className="size-3" />
                  </button>
                </Badge>
              </li>
            )
          })}
        </ul>
      )}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          render={
            <Button id={id} type="button" variant="outline" className="justify-start" aria-invalid={ariaInvalid} />
          }
        >
          {selection.multiple ? <Trans>Choose categories</Trans> : <Trans>Choose a category</Trans>}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 gap-1.5">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t`Search categories`}
            aria-label={t`Search categories`}
          />
          {search ? (
            <CategoryList
              empty={t`No categories found`}
              rows={matches.map((row) => {
                // "Tops in Men", or "T-shirts in Men › Tops" deeper down.
                const ancestors = row.ancestors.join(' › ')
                return { category: row.category, detail: row.ancestors.length > 0 ? t`in ${ancestors}` : undefined }
              })}
              selected={selected}
              canChoose={canChoose}
              onToggle={toggle}
            />
          ) : (
            <>
              {!!current && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => setTrail(trail.slice(0, -1))}
                >
                  <ChevronLeftIcon />
                  {current.name}
                </Button>
              )}
              <CategoryList
                empty={t`No categories yet`}
                rows={level.map((category) => ({ category }))}
                selected={selected}
                canChoose={canChoose}
                onToggle={toggle}
                onOpen={(category) => setTrail([...trail, category])}
              />
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

type CategoryListProps = {
  rows: { category: AdminProductCategoryTreeNode; detail?: string }[]
  selected: Set<string>
  canChoose: (category: AdminProductCategoryTreeNode) => boolean
  onToggle: (categoryId: string) => void
  /** Set while browsing: a Category with children can be opened to its next level. */
  onOpen?: (category: AdminProductCategoryTreeNode) => void
  empty: string
}

function CategoryList({ rows, selected, canChoose, onToggle, onOpen, empty }: CategoryListProps) {
  const { t } = useLingui()
  if (rows.length === 0) return <p className="px-2 py-4 text-center text-muted-foreground">{empty}</p>

  return (
    <ul className="flex max-h-72 flex-col overflow-y-auto">
      {rows.map(({ category, detail }) => {
        const name = category.name
        return (
          <li key={category.id} className="flex items-center gap-x-1 rounded-md hover:bg-muted">
            {/* biome-ignore lint/a11y/noLabelWithoutControl: the Checkbox inside renders the control */}
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-x-2 px-2 py-1.5">
              <Checkbox
                checked={selected.has(category.id)}
                disabled={!canChoose(category)}
                onCheckedChange={() => onToggle(category.id)}
              />
              <span className="truncate">{name}</span>
              {!!detail && <span className="truncate text-muted-foreground text-xs">{detail}</span>}
            </label>
            {!!onOpen && category.children.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t`Show categories in ${name}`}
                onClick={() => onOpen(category)}
              >
                <ChevronRightIcon />
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
