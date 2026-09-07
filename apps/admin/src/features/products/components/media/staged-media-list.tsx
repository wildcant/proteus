import {
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
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button, cn } from '@proteus/ui'
import { GripVerticalIcon, StarIcon, TrashIcon } from 'lucide-react'
import { useState } from 'react'
import { ActionMenu } from '#/components/common/action-menu'
import type { ProductMedia } from '#/features/products/utils/media'
import { formatFileSize } from '#/lib/format-file-size.ts'

const DROP_ANIMATION: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
}

type StagedMediaListProps = {
  media: ProductMedia[]
  onChange: (media: ProductMedia[]) => void
}

/** Vertical, reorderable list of images staged for upload on the product create form. */
export function StagedMediaList({ media, onChange }: StagedMediaListProps) {
  const [draggingKey, setDraggingKey] = useState<UniqueIdentifier | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const draggingMedia = media.find((item) => item.key === draggingKey)

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingKey(null)

    if (!over || active.id === over.id) {
      return
    }

    const from = media.findIndex((item) => item.key === active.id)
    const to = media.findIndex((item) => item.key === over.id)
    onChange(arrayMove(media, from, to))
  }

  const handleDelete = (key: string) => onChange(media.filter((item) => item.key !== key))

  const handleMakeThumbnail = (key: string) =>
    onChange(media.map((item) => ({ ...item, isThumbnail: item.key === key })))

  if (media.length === 0) {
    return null
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }: DragStartEvent) => setDraggingKey(active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingKey(null)}
    >
      <ul className="flex flex-col gap-y-2">
        <SortableContext items={media.map((item) => item.key)} strategy={verticalListSortingStrategy}>
          {media.map((item) => (
            <SortableMediaRow
              key={item.key}
              media={item}
              onDelete={() => handleDelete(item.key)}
              onMakeThumbnail={() => handleMakeThumbnail(item.key)}
            />
          ))}
        </SortableContext>
      </ul>
      <DragOverlay dropAnimation={DROP_ANIMATION}>
        {draggingMedia ? <MediaRow media={draggingMedia} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

type MediaRowProps = {
  media: ProductMedia
  onDelete?: () => void
  onMakeThumbnail?: () => void
}

function SortableMediaRow({ media, onDelete, onMakeThumbnail }: MediaRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: media.key,
  })

  return (
    <MediaRow
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.4 : undefined, transform: CSS.Translate.toString(transform), transition }}
      media={media}
      onDelete={onDelete}
      onMakeThumbnail={onMakeThumbnail}
      handle={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          ref={setActivatorNodeRef}
          className={cn('cursor-grab touch-none', isDragging && 'cursor-grabbing')}
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="text-muted-foreground" />
          <span className="sr-only">Reorder</span>
        </Button>
      }
    />
  )
}

type MediaRowTileProps = MediaRowProps & {
  ref?: React.Ref<HTMLLIElement>
  style?: React.CSSProperties
  handle?: React.ReactNode
}

function MediaRow({ ref, style, media, onDelete, onMakeThumbnail, handle }: MediaRowTileProps) {
  return (
    <li
      ref={ref}
      style={style}
      data-slot="media-row"
      className="flex items-center justify-between rounded-lg border bg-card px-3 py-2"
    >
      <div className="flex items-center gap-x-2">
        {handle}
        <div className="h-10 w-8 shrink-0 overflow-hidden rounded-md bg-muted">
          <img src={media.url} alt="" className="size-full object-cover object-center" />
        </div>
        <div className="flex flex-col text-sm">
          <span className="line-clamp-1">{media.file?.name}</span>
          <span className="flex items-center gap-x-1 text-muted-foreground text-xs">
            {!!media.isThumbnail && <StarIcon className="size-3 fill-current" />}
            {formatFileSize(media.file?.size ?? 0)}
          </span>
        </div>
      </div>
      {!!onDelete && !!onMakeThumbnail && (
        <ActionMenu
          groups={[
            { actions: [{ label: 'Make thumbnail', onClick: onMakeThumbnail, icon: <StarIcon /> }] },
            { actions: [{ label: 'Delete', onClick: onDelete, icon: <TrashIcon /> }] },
          ]}
        />
      )}
    </li>
  )
}
