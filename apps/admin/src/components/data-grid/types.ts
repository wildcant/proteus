type DataGridColumnBase<T> = {
  header: string
  accessorKey: keyof T & string
}

type TextColumn<T> = DataGridColumnBase<T> & {
  type: 'text'
}

type CheckboxColumn<T> = DataGridColumnBase<T> & {
  type: 'checkbox'
}

/** Derived or otherwise fixed: rendered, focusable for navigation, never editable. */
type ReadonlyColumn<T> = DataGridColumnBase<T> & {
  type: 'readonly'
}

type CurrencyColumn<T> = DataGridColumnBase<T> & {
  type: 'currency'
  currencyCode: string
}

export type DataGridColumn<T> = TextColumn<T> | CheckboxColumn<T> | CurrencyColumn<T> | ReadonlyColumn<T>

export type CellCoordinates = {
  row: number
  col: number
}

export type GridState = {
  focused: CellCoordinates | null
  editing: CellCoordinates | null
  draftValue: string
}

export type GridAction =
  | { type: 'focus'; coords: CellCoordinates }
  | { type: 'blur' }
  | { type: 'startEdit'; coords: CellCoordinates; initialValue: string }
  | { type: 'setDraft'; value: string }
  | { type: 'commitEdit' }
  | { type: 'cancelEdit' }
