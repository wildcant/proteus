import type { DraggableAttributes } from '@dnd-kit/core'
import {
  type Active,
  DndContext,
  type DragEndEvent,
  type DraggableSyntheticListeners,
  DragOverlay,
  type DragStartEvent,
  type DropAnimation,
  defaultDropAnimationSideEffects,
  KeyboardSensor,
  PointerSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button, cn } from '@proteus/ui'
import { GripVertical } from 'lucide-react'
import {
  type CSSProperties,
  createContext,
  Fragment,
  type PropsWithChildren,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from 'react'

type SortableBaseItem = { id: UniqueIdentifier }

type SortableListProps<TItem extends SortableBaseItem> = {
  items: TItem[]
  onChange: (items: TItem[]) => void
  renderItem: (item: TItem, index: number) => ReactNode
}

/** Ported from Medusa's `components/common/sortable-list`, on `@proteus/ui` and lucide icons. */
export function SortableListRoot<TItem extends SortableBaseItem>({
  items,
  onChange,
  renderItem,
}: SortableListProps<TItem>) {
  const [active, setActive] = useState<Active | null>(null)

  const [activeItem, activeIndex] = useMemo(() => {
    if (active === null) return [null, null]
    const index = items.findIndex(({ id }) => id === active.id)
    return [items[index], index]
  }, [active, items])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    if (over && dragged.id !== over.id) {
      onChange(
        arrayMove(
          items,
          items.findIndex(({ id }) => id === dragged.id),
          items.findIndex(({ id }) => id === over.id),
        ),
      )
    }
    setActive(null)
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active: started }: DragStartEvent) => setActive(started)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActive(null)}
    >
      <DragOverlay className="overflow-hidden rounded-md shadow-lg [&>li]:border-b-0" dropAnimation={DROP_ANIMATION}>
        {activeItem && activeIndex !== null ? renderItem(activeItem, activeIndex) : null}
      </DragOverlay>
      <SortableContext items={items}>
        <ul className="flex list-none flex-col p-0">
          {items.map((item, index) => (
            <Fragment key={item.id}>{renderItem(item, index)}</Fragment>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

const DROP_ANIMATION: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
}

type SortableItemContextValue = {
  attributes: DraggableAttributes
  listeners: DraggableSyntheticListeners
  ref: (node: HTMLElement | null) => void
  isDragging: boolean
}

const SortableItemContext = createContext<SortableItemContextValue | null>(null)

function useSortableItemContext() {
  const context = useContext(SortableItemContext)
  if (!context) throw new Error('SortableList.DragHandle must be rendered inside a SortableList.Item')
  return context
}

export function SortableListItem({
  id,
  className,
  children,
}: PropsWithChildren<{ id: UniqueIdentifier; className?: string }>) {
  const { attributes, isDragging, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({
    id,
  })

  const context = useMemo(
    () => ({ attributes, listeners, ref: setActivatorNodeRef, isDragging }),
    [attributes, listeners, setActivatorNodeRef, isDragging],
  )

  const style: CSSProperties = {
    opacity: isDragging ? 0.4 : undefined,
    transform: CSS.Translate.toString(transform),
    transition,
  }

  return (
    <SortableItemContext.Provider value={context}>
      <li className={cn('flex flex-1 list-none', className)} ref={setNodeRef} style={style}>
        {children}
      </li>
    </SortableItemContext.Provider>
  )
}

export function SortableListDragHandle() {
  const { attributes, listeners, ref } = useSortableItemContext()

  return (
    <Button
      variant="ghost"
      size="sm"
      {...attributes}
      {...listeners}
      ref={ref}
      className="cursor-grab touch-none active:cursor-grabbing"
      aria-label="Reorder"
    >
      <GripVertical className="size-4 text-muted-foreground" />
    </Button>
  )
}
