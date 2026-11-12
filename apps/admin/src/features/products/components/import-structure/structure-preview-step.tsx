import { Trans, useLingui } from '@lingui/react/macro'
import { Button, RouteFocusModal, toast, useRouteModal } from '@proteus/ui'
import { InfoIcon } from 'lucide-react'
import type { AdminCatalogStructureMetafieldChange, AdminNavigationEntry } from '#/api/generated/model'
import { useApplyCatalogStructure } from '#/features/products/api/catalog-structure'
import type { PreviewedCatalogStructure } from '#/features/products/hooks/use-upload-catalog-structure-form'

type ChangeRow = { key: string; label: string; detail: string }

/** Step two: every metafield and grouping the file creates, changes, moves or deletes, and the menu it leaves. */
export function StructurePreviewStep({ fileId, plan }: PreviewedCatalogStructure) {
  const { t } = useLingui()
  const { handleSuccess } = useRouteModal()
  const apply = useApplyCatalogStructure()
  const { metafields, categories, collections } = plan

  const atRoot = t`top level`
  // The key, whether the campo is the product's brand rather than a metafield, and whether the
  // storefront offers it as a filter.
  const metafieldDetail = (row: AdminCatalogStructureMetafieldChange) =>
    [row.key, row.source === 'vendor' ? t`brand` : null, row.filterable ? t`filter` : null]
      .filter((part) => part !== null)
      .join(' · ')
  const under = (parentHandle: string | null | undefined) => parentHandle ?? atRoot
  const groups: { title: string; rows: ChangeRow[]; destructive?: boolean }[] = [
    {
      title: t`Metafields to create`,
      rows: metafields.create.map((row) => ({ key: row.key, label: row.name, detail: metafieldDetail(row) })),
    },
    {
      title: t`Metafields to update`,
      rows: metafields.update.map((row) => ({ key: row.key, label: row.name, detail: metafieldDetail(row) })),
    },
    {
      title: t`Metafields to delete`,
      rows: metafields.delete.map((row) => ({ key: row.key, label: row.name, detail: row.key })),
      destructive: true,
    },
    {
      title: t`Categories to create`,
      rows: categories.create.map((row) => ({ key: row.handle, label: row.name, detail: under(row.parentHandle) })),
    },
    {
      title: t`Categories to update`,
      rows: categories.update.map((row) => ({ key: row.handle, label: row.name, detail: row.handle })),
    },
    {
      title: t`Categories to move`,
      rows: categories.move.map((row) => ({
        key: row.handle,
        label: row.name,
        detail: `${under(row.previousParentHandle)} → ${under(row.parentHandle)}`,
      })),
    },
    {
      title: t`Categories to delete`,
      rows: categories.delete.map((row) => ({ key: row.handle, label: row.name, detail: row.handle })),
      destructive: true,
    },
    {
      title: t`Collections to create`,
      rows: collections.create.map((row) => ({ key: row.handle, label: row.name, detail: row.handle })),
    },
    {
      title: t`Collections to update`,
      rows: collections.update.map((row) => ({ key: row.handle, label: row.name, detail: row.handle })),
    },
    {
      title: t`Collections to delete`,
      rows: collections.delete.map((row) => ({ key: row.handle, label: row.name, detail: row.handle })),
      destructive: true,
    },
  ].filter((group) => group.rows.length > 0)

  const menuChanges = !sameMenu(plan.menu.current, plan.menu.next)

  return (
    <>
      <RouteFocusModal.Body>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-y-6 px-6 py-8">
          <h1 className="font-medium text-xl">
            <Trans>Preview the structure</Trans>
          </h1>

          <p className="flex items-start gap-x-2 rounded-md border border-blue-500/30 bg-blue-500/5 p-3 text-sm">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-blue-500 dark:text-blue-400" aria-hidden="true" />
            <Trans>
              Metafields are matched by key, categories and collections by handle. Applying makes every category in the
              file active and re-matches every rule against the products' metafields. Deleting a metafield deletes its
              values on every product.
            </Trans>
          </p>

          {groups.length === 0 && !menuChanges && (
            <p className="text-muted-foreground text-sm">
              <Trans>The store already has this structure. Applying it changes nothing.</Trans>
            </p>
          )}

          {groups.map((group) => (
            <section key={group.title} className="flex flex-col gap-y-2">
              <h2 className={group.destructive ? 'font-medium text-destructive text-sm' : 'font-medium text-sm'}>
                {group.title}
              </h2>
              <ul className="flex flex-col gap-y-1 text-sm">
                {group.rows.map((row) => (
                  <li key={row.key} className="flex items-baseline gap-x-2">
                    <span>{row.label}</span>
                    <span className="text-muted-foreground text-xs">{row.detail}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="flex flex-col gap-y-2">
            <h2 className="font-medium text-sm">
              <Trans>Menu</Trans>
            </h2>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">
                <Trans>Now</Trans>
              </dt>
              <dd>
                <MenuEntries entries={plan.menu.current} />
              </dd>
              <dt className="text-muted-foreground">
                <Trans>After</Trans>
              </dt>
              <dd>
                <MenuEntries entries={plan.menu.next} />
              </dd>
            </dl>
          </section>
        </div>
      </RouteFocusModal.Body>

      <RouteFocusModal.Footer>
        <RouteFocusModal.Close render={<Button variant="secondary" size="sm" />} disabled={apply.isPending}>
          <Trans>Cancel</Trans>
        </RouteFocusModal.Close>
        <Button
          type="button"
          size="sm"
          disabled={apply.isPending}
          onClick={() =>
            apply.mutate(
              { fileId },
              {
                onSuccess: () => {
                  toast.add({ type: 'success', title: t`Structure applied` })
                  handleSuccess()
                },
              },
            )
          }
        >
          <Trans>Apply structure</Trans>
        </Button>
      </RouteFocusModal.Footer>
    </>
  )
}

function MenuEntries({ entries }: { entries: AdminNavigationEntry[] }) {
  if (entries.length === 0) {
    return (
      <span className="text-muted-foreground">
        <Trans>Empty</Trans>
      </span>
    )
  }
  return (
    <ol className="flex flex-wrap gap-x-2">
      {entries.map(({ type, handle, sections }, index) => {
        const sectionNames = sections.map((section) => section.name).join(', ')
        return (
          <li key={`${type}:${handle}`}>
            {index > 0 && (
              <span className="pr-2 text-muted-foreground" aria-hidden="true">
                ·
              </span>
            )}
            {type === 'collection' ? <Trans>{handle} (collection)</Trans> : <span>{handle}</span>}
            {/* The panel's columns, so a change to a section shows up as a change to the menu. */}
            {sections.length > 0 && (
              <span className="pl-1 text-muted-foreground">
                <Trans>(sections: {sectionNames})</Trans>
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

function sameMenu(left: AdminNavigationEntry[], right: AdminNavigationEntry[]) {
  return JSON.stringify(left) === JSON.stringify(right)
}
