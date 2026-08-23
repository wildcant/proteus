import { SortableListDragHandle, SortableListItem, SortableListRoot } from './sortable-list'

/**
 * Composed here rather than in the component module: the compound object is not itself a
 * component, and a `.tsx` module that exports one trips `useComponentExportOnlyModules`.
 */
export const SortableList = Object.assign(SortableListRoot, {
  Item: SortableListItem,
  DragHandle: SortableListDragHandle,
})
