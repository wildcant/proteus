import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button, Card, CardDescription, CardHeader, CardTitle, cn } from '@proteus/ui'
import { GripVertical } from 'lucide-react'
import { type CSSProperties, type ReactNode, useMemo, useRef, useState } from 'react'
import type { AdminProductCategoryTreeNode } from '#/api/generated/model'
import { useMoveCategory } from '#/features/categories/api/categories'
import {
  type FlatTreeItem,
  flattenTree,
  getDropMove,
  getProjection,
  removeChildrenOf,
} from '#/features/categories/utils/sortable-category-tree'
import {
  type SensorContext,
  sortableTreeKeyboardCoordinates,
} from '#/features/categories/utils/sortable-tree-keyboard-coordinates'

/** One level of depth, in pixels: both the indent drawn and the horizontal drag that changes level. */
const INDENTATION_WIDTH = 24

/**
 * The Category tree as one draggable list. A drop saves at once through `useMoveCategory`, which
 * shows the new tree before the save answers and restores the old one if it fails.
 */
export function CategoryOrganizeTree({ categories }: { categories: AdminProductCategoryTreeNode[] }) {
  const { t } = useLingui()
  const { mutate: moveCategory } = useMoveCategory()
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null)
  const [offsetLeft, setOffsetLeft] = useState(0)

  const allItems = useMemo(() => flattenTree(categories), [categories])
  // The dragged row's descendants travel with it, so they are not places it can be dropped.
  const items = useMemo(() => (activeId ? removeChildrenOf(allItems, [activeId]) : allItems), [allItems, activeId])
  const projection = activeId && overId ? getProjection(items, activeId, overId, offsetLeft, INDENTATION_WIDTH) : null
  const activeItem = activeId ? allItems.find(({ id }) => id === activeId) : undefined

  const sensorContext: SensorContext = useRef({ items, offset: offsetLeft })
  sensorContext.current = { items, offset: offsetLeft }
  const [coordinateGetter] = useState(() => sortableTreeKeyboardCoordinates(sensorContext, INDENTATION_WIDTH))
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter }))

  const nameOf = (id: UniqueIdentifier) => allItems.find((item) => item.id === id)?.category.name ?? ''
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const name = nameOf(active.id)
      return t`Picked up ${name}.`
    },
    onDragOver: ({ active, over }) => {
      if (!over) return undefined
      const name = nameOf(active.id)
      const overName = nameOf(over.id)
      return t`${name} is over ${overName}.`
    },
    onDragEnd: ({ active }) => {
      const name = nameOf(active.id)
      return t`${name} was dropped.`
    },
    onDragCancel: ({ active }) => {
      const name = nameOf(active.id)
      return t`Moving ${name} was cancelled.`
    },
  }

  const reset = () => {
    setActiveId(null)
    setOverId(null)
    setOffsetLeft(0)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const move = over && projection ? getDropMove(allItems, active.id, over.id, projection) : null
    reset()
    if (move) moveCategory(move)
  }

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader className="py-4">
        <CardTitle>
          <Trans>Organize categories</Trans>
        </CardTitle>
        <CardDescription>
          <Trans>
            Drag a category up or down to reorder it, or right and left to move it under another category or out of one.
            Each move is saved at once.
          </Trans>
        </CardDescription>
      </CardHeader>
      {allItems.length === 0 ? (
        <p className="px-6 py-8 text-center text-muted-foreground text-sm">
          <Trans>No categories yet. Create one to start the tree.</Trans>
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          accessibility={{
            announcements,
            screenReaderInstructions: {
              draggable: t`To pick up a category, press space or enter. Use the up and down arrow keys to move it, and the left and right arrow keys to change its level. Press space or enter again to drop it, or escape to cancel.`,
            },
          }}
          onDragStart={({ active }: DragStartEvent) => {
            setActiveId(active.id)
            setOverId(active.id)
          }}
          onDragMove={({ delta }: DragMoveEvent) => setOffsetLeft(delta.x)}
          onDragOver={({ over }: DragOverEvent) => setOverId(over?.id ?? null)}
          onDragEnd={handleDragEnd}
          onDragCancel={reset}
        >
          <SortableContext items={items.map(({ id }) => id)} strategy={verticalListSortingStrategy}>
            <ul className="flex list-none flex-col divide-y p-0">
              {items.map((item) => (
                <SortableTreeRow
                  key={item.id}
                  item={item}
                  depth={item.id === activeId && projection ? projection.depth : item.depth}
                />
              ))}
            </ul>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeItem ? <TreeRowContent item={activeItem} className="rounded-md bg-background shadow-lg" /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </Card>
  )
}

function SortableTreeRow({ item, depth }: { item: FlatTreeItem; depth: number }) {
  const { t } = useLingui()
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setDraggableNodeRef,
    setDroppableNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id })
  const name = item.category.name

  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition }

  return (
    // The row spans the full width so every drop target lines up; the indent sits inside it, which is
    // what lets the keyboard getter read a level change as a horizontal offset.
    <li ref={setDroppableNodeRef} style={{ paddingLeft: `${depth * INDENTATION_WIDTH}px` }}>
      <div ref={setDraggableNodeRef} style={style} className={cn(isDragging && 'opacity-40')}>
        <TreeRowContent
          item={item}
          handle={
            <Button
              variant="ghost"
              size="sm"
              {...attributes}
              {...listeners}
              ref={setActivatorNodeRef}
              className="cursor-grab touch-none active:cursor-grabbing"
              aria-label={t`Move ${name}`}
            >
              <GripVertical className="size-4 text-muted-foreground" />
            </Button>
          }
        />
      </div>
    </li>
  )
}

function TreeRowContent({ item, handle, className }: { item: FlatTreeItem; handle?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center gap-x-3 py-2 pr-6 pl-4 text-sm', className)}>
      {handle ?? <GripVertical aria-hidden className="mx-2 size-4 text-muted-foreground" />}
      <span className="font-medium">{item.category.name}</span>
      <span className="truncate text-muted-foreground">{item.category.handle}</span>
    </div>
  )
}
