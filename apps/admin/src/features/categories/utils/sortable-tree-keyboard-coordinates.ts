import {
  closestCorners,
  type DroppableContainer,
  getFirstCollision,
  KeyboardCode,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core'
import { type FlatTreeItem, getProjection } from '#/features/categories/utils/sortable-category-tree'

/** What the getter reads while a drag is in progress, kept current by the tree on every render. */
export type SensorContext = { current: { items: FlatTreeItem[]; offset: number } }

type GetterArguments = Parameters<KeyboardCoordinateGetter>[1]

const VERTICAL: string[] = [KeyboardCode.Down, KeyboardCode.Up]
const HORIZONTAL: string[] = [KeyboardCode.Left, KeyboardCode.Right]

/**
 * Keyboard dragging for the tree, ported from dnd-kit's tree example: up and down move to the row
 * above or below, left and right change the depth one indent at a time within what the drop allows.
 */
export const sortableTreeKeyboardCoordinates =
  (context: SensorContext, indentationWidth: number): KeyboardCoordinateGetter =>
  (event, args) => {
    const isHorizontal = HORIZONTAL.includes(event.code)
    if (!isHorizontal && !VERTICAL.includes(event.code)) return undefined
    if (!args.context.active || !args.context.collisionRect) return undefined
    event.preventDefault()
    return isHorizontal
      ? changeLevel(event.code, args, context, indentationWidth)
      : stepToRow(event.code, args, context, indentationWidth)
  }

function changeLevel(code: string, args: GetterArguments, context: SensorContext, indentationWidth: number) {
  const { active, over } = args.context
  if (!active || !over) return undefined
  const { items, offset } = context.current
  const projection = getProjection(items, active.id, over.id, offset, indentationWidth)
  if (!projection) return undefined

  const { currentCoordinates } = args
  if (code === KeyboardCode.Left && projection.depth > projection.minDepth) {
    return { ...currentCoordinates, x: currentCoordinates.x - indentationWidth }
  }
  if (code === KeyboardCode.Right && projection.depth < projection.maxDepth) {
    return { ...currentCoordinates, x: currentCoordinates.x + indentationWidth }
  }
  return undefined
}

function stepToRow(code: string, args: GetterArguments, context: SensorContext, indentationWidth: number) {
  const { active, over, collisionRect, droppableRects, droppableContainers } = args.context
  if (!active || !over || !collisionRect) return undefined

  const candidates: DroppableContainer[] = droppableContainers.getEnabled().filter((container) => {
    const rect = droppableRects.get(container.id)
    if (container.id === over.id || !rect) return false
    return code === KeyboardCode.Down ? collisionRect.top < rect.top : collisionRect.top > rect.top
  })
  const collisions = closestCorners({
    active,
    collisionRect,
    pointerCoordinates: null,
    droppableRects,
    droppableContainers: candidates,
  })
  const closestId = getFirstCollision(collisions, 'id')
  if (closestId === null) return undefined

  const { items } = context.current
  const newRect = droppableRects.get(closestId)
  const newItem = items.find(({ id }) => id === closestId)
  const activeItem = items.find(({ id }) => id === active.id)
  if (!newRect || !newItem || !activeItem) return undefined

  // Land at the depth the row being passed sits at, so stepping down a list keeps its level.
  const projection = getProjection(
    items,
    active.id,
    closestId,
    (newItem.depth - activeItem.depth) * indentationWidth,
    indentationWidth,
  )
  return { x: newRect.left + (projection?.depth ?? 0) * indentationWidth, y: newRect.top }
}
