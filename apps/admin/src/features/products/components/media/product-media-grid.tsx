import {
  closestCenter,
  DndContext,
  type DragEndEvent,
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
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Checkbox,
  CommandBar,
  CommandBarCommand,
  CommandBarSeparator,
  CommandBarValue,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@proteus/ui'
import { ImageIcon, StarIcon } from 'lucide-react'
import { useState } from 'react'
import type { ProductMedia } from '#/features/products/utils/media'

const DROP_ANIMATION: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
}

type ProductMediaGridProps = {
  media: ProductMedia[]
  onChange: (media: ProductMedia[]) => void
}

/** Reorderable image grid with a selection command bar for deleting and picking the thumbnail. */
export function ProductMediaGrid({ media, onChange }: ProductMediaGridProps) {
  const [selection, setSelection] = useState<Record<string, boolean>>({})
  const [draggingKey, setDraggingKey] = useState<UniqueIdentifier | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const selectedKeys = Object.keys(selection)
  const draggingMedia = media.find((item) => item.key === draggingKey)

  const toggleSelected = (key: string) => {
    setSelection((prev) => {
      const { [key]: isSelected, ...rest } = prev
      return isSelected ? rest : { ...prev, [key]: true }
    })
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingKey(null)

    if (!over || active.id === over.id) {
      return
    }

    const from = media.findIndex((item) => item.key === active.id)
    const to = media.findIndex((item) => item.key === over.id)
    onChange(arrayMove(media, from, to))
  }

  const handleDelete = () => {
    onChange(media.filter((item) => !selection[item.key]))
    setSelection({})
  }

  const handleMakeThumbnail = () => {
    const [key] = selectedKeys
    onChange(media.map((item) => ({ ...item, isThumbnail: item.key === key })))
    setSelection({})
  }

  if (media.length === 0) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-y-2 p-6">
        <ImageIcon className="size-6 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Uploaded media will appear here.</p>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }: DragStartEvent) => setDraggingKey(active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingKey(null)}
    >
      <div className="grid h-fit auto-rows-auto grid-cols-2 gap-6 p-6 xl:grid-cols-4">
        <SortableContext items={media.map((item) => item.key)} strategy={rectSortingStrategy}>
          {media.map((item) => (
            <SortableMediaItem
              key={item.key}
              media={item}
              checked={!!selection[item.key]}
              onCheckedChange={() => toggleSelected(item.key)}
            />
          ))}
        </SortableContext>
        <DragOverlay dropAnimation={DROP_ANIMATION}>
          {draggingMedia ? <MediaItem media={draggingMedia} checked={!!selection[draggingMedia.key]} /> : null}
        </DragOverlay>
      </div>
      <CommandBar open={selectedKeys.length > 0}>
        <CommandBarValue>{selectedKeys.length} selected</CommandBarValue>
        <CommandBarSeparator />
        {selectedKeys.length === 1 && (
          <>
            <CommandBarCommand action={handleMakeThumbnail} label="Make thumbnail" shortcut="t" />
            <CommandBarSeparator />
          </>
        )}
        <CommandBarCommand action={handleDelete} label="Delete" shortcut="d" />
      </CommandBar>
    </DndContext>
  )
}

type MediaItemProps = {
  media: ProductMedia
  checked: boolean
  onCheckedChange?: () => void
}

function SortableMediaItem({ media, checked, onCheckedChange }: MediaItemProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: media.key,
  })

  return (
    <MediaItem
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.4 : undefined, transform: CSS.Transform.toString(transform), transition }}
      media={media}
      checked={checked}
      onCheckedChange={onCheckedChange}
      // The whole tile is the drag handle; the checkbox stacks above it to stay clickable.
      activator={
        <div
          ref={setActivatorNodeRef}
          className={cn('absolute inset-0 cursor-grab touch-none outline-none', isDragging && 'cursor-grabbing')}
          {...attributes}
          {...listeners}
        />
      }
    />
  )
}

type MediaTileProps = MediaItemProps & {
  ref?: React.Ref<HTMLDivElement>
  style?: React.CSSProperties
  activator?: React.ReactNode
}

function MediaItem({ ref, style, media, checked, onCheckedChange, activator }: MediaTileProps) {
  return (
    <div
      ref={ref}
      style={style}
      data-slot="media-tile"
      className="group relative aspect-square size-full overflow-hidden rounded-lg border bg-muted shadow-sm outline-none"
    >
      {!!media.isThumbnail && (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className="absolute top-2 left-2 z-20 cursor-default rounded-full bg-background p-1 text-foreground shadow-sm"
              />
            }
          >
            <StarIcon className="size-3.5 fill-current" />
            <span className="sr-only">Thumbnail</span>
          </TooltipTrigger>
          <TooltipContent>Thumbnail</TooltipContent>
        </Tooltip>
      )}
      <img src={media.url} alt="" className="size-full object-cover object-center" />
      {activator}
      <div
        className={cn(
          'invisible absolute top-2 right-2 z-20 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100',
          checked && 'visible opacity-100',
        )}
      >
        <Checkbox
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-label="Select image"
          className="bg-background"
        />
      </div>
    </div>
  )
}
