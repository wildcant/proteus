import { useCallback, useEffect, useReducer } from 'react'
import type { CellCoordinates, DataGridColumn, GridAction, GridState } from './types'

const initialState: GridState = {
  focused: null,
  editing: null,
  draftValue: '',
}

function gridReducer(state: GridState, action: GridAction): GridState {
  switch (action.type) {
    case 'focus':
      return { ...state, focused: action.coords }
    case 'blur':
      return { ...state, focused: null, editing: null, draftValue: '' }
    case 'startEdit':
      return { ...state, editing: action.coords, focused: action.coords, draftValue: action.initialValue }
    case 'setDraft':
      return { ...state, draftValue: action.value }
    case 'commitEdit':
      return { ...state, editing: null, draftValue: '' }
    case 'cancelEdit':
      return { ...state, editing: null, draftValue: '' }
  }
}

function isEditableColumn<T>(column: DataGridColumn<T>): boolean {
  return column.type === 'text' || column.type === 'currency'
}

function isPrintableKey(event: React.KeyboardEvent): boolean {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
}

type UseGridNavigationOptions<T> = {
  data: T[]
  columns: DataGridColumn<T>[]
  onChange: (updatedData: T[]) => void
  onEditingChange?: (isEditing: boolean) => void
}

export function useGridNavigation<T>({ data, columns, onChange, onEditingChange }: UseGridNavigationOptions<T>) {
  const [state, dispatch] = useReducer(gridReducer, initialState)

  const rowCount = data.length
  const colCount = columns.length

  useEffect(() => {
    onEditingChange?.(state.editing !== null)
  }, [state.editing, onEditingChange])

  const commitEdit = useCallback(() => {
    if (!state.editing) return

    const { row, col } = state.editing
    const column = columns[col]
    if (!column) return

    const currentRow = data[row]
    if (!currentRow) return

    const updatedRow = { ...currentRow, [column.accessorKey]: state.draftValue }
    const updatedData = data.map((item, index) => (index === row ? updatedRow : item))
    onChange(updatedData)
    dispatch({ type: 'commitEdit' })
  }, [state.editing, state.draftValue, columns, data, onChange])

  const cancelEdit = useCallback(() => {
    dispatch({ type: 'cancelEdit' })
  }, [])

  const startEditing = useCallback(
    (row: number, col: number, initialValue?: string) => {
      const column = columns[col]
      if (!column || !isEditableColumn(column)) return

      const currentRow = data[row]
      if (!currentRow) return

      const value = initialValue ?? String(currentRow[column.accessorKey] ?? '')
      dispatch({ type: 'startEdit', coords: { row, col }, initialValue: value })
    },
    [columns, data],
  )

  const toggleCheckbox = useCallback(
    (row: number, col: number) => {
      const column = columns[col]
      if (column?.type !== 'checkbox') return

      const currentRow = data[row]
      if (!currentRow) return

      const currentValue = Boolean(currentRow[column.accessorKey])
      const updatedRow = { ...currentRow, [column.accessorKey]: !currentValue }
      const updatedData = data.map((item, index) => (index === row ? updatedRow : item))
      onChange(updatedData)
    },
    [columns, data, onChange],
  )

  const moveFocus = useCallback(
    (rowDelta: number, colDelta: number) => {
      if (!state.focused) return

      let nextRow = state.focused.row + rowDelta
      let nextCol = state.focused.col + colDelta

      // Wrap columns across rows
      if (nextCol < 0) {
        nextCol = colCount - 1
        nextRow -= 1
      } else if (nextCol >= colCount) {
        nextCol = 0
        nextRow += 1
      }

      // Clamp rows
      if (nextRow < 0 || nextRow >= rowCount) return

      dispatch({ type: 'focus', coords: { row: nextRow, col: nextCol } })
    },
    [state.focused, rowCount, colCount],
  )

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      const column = columns[col]
      if (!column) return

      if (column.type === 'checkbox') {
        dispatch({ type: 'focus', coords: { row, col } })
        toggleCheckbox(row, col)
        return
      }

      // If already editing this cell, do nothing (let input handle clicks)
      if (state.editing?.row === row && state.editing?.col === col) return

      // If editing another cell, commit first
      if (state.editing) {
        commitEdit()
      }

      dispatch({ type: 'focus', coords: { row, col } })
    },
    [columns, state.editing, toggleCheckbox, commitEdit],
  )

  const handleCellDoubleClick = useCallback(
    (row: number, col: number) => {
      startEditing(row, col)
    },
    [startEditing],
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!state.focused) return

      const { row, col } = state.focused
      const column = columns[col]
      if (!column) return

      // When editing, only handle specific keys
      if (state.editing) {
        switch (event.key) {
          case 'Escape':
            event.preventDefault()
            event.stopPropagation()
            cancelEdit()
            return
          case 'Enter':
            event.preventDefault()
            commitEdit()
            // Move focus down after committing
            if (row + 1 < rowCount) {
              dispatch({ type: 'focus', coords: { row: row + 1, col } })
            }
            return
          case 'Tab': {
            event.preventDefault()
            commitEdit()
            const delta = event.shiftKey ? -1 : 1
            moveFocus(0, delta)
            return
          }
          default:
            return
        }
      }

      // Not editing — handle navigation and edit triggers
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault()
          moveFocus(-1, 0)
          return
        case 'ArrowDown':
          event.preventDefault()
          moveFocus(1, 0)
          return
        case 'ArrowLeft':
          event.preventDefault()
          moveFocus(0, -1)
          return
        case 'ArrowRight':
          event.preventDefault()
          moveFocus(0, 1)
          return
        case 'Tab': {
          event.preventDefault()
          const delta = event.shiftKey ? -1 : 1
          moveFocus(0, delta)
          return
        }
        case 'Enter':
          event.preventDefault()
          if (column.type === 'checkbox') {
            toggleCheckbox(row, col)
          } else {
            startEditing(row, col)
          }
          return
        case ' ':
          event.preventDefault()
          if (column.type === 'checkbox') {
            toggleCheckbox(row, col)
          } else {
            startEditing(row, col, '')
          }
          return
        case 'Escape':
          event.preventDefault()
          dispatch({ type: 'blur' })
          return
        case 'F2':
          event.preventDefault()
          startEditing(row, col)
          return
        default:
          // Start editing on printable character input (text/currency only)
          if (isPrintableKey(event) && isEditableColumn(column)) {
            event.preventDefault()
            startEditing(row, col, event.key)
          }
      }
    },
    [state.focused, state.editing, columns, rowCount, commitEdit, cancelEdit, moveFocus, startEditing, toggleCheckbox],
  )

  const setFocused = useCallback((coords: CellCoordinates | null) => {
    if (coords) {
      dispatch({ type: 'focus', coords })
    } else {
      dispatch({ type: 'blur' })
    }
  }, [])

  const setDraftValue = useCallback((value: string) => {
    dispatch({ type: 'setDraft', value })
  }, [])

  return {
    focused: state.focused,
    editing: state.editing,
    draftValue: state.draftValue,
    setFocused,
    setDraftValue,
    handleCellClick,
    handleCellDoubleClick,
    handleKeyDown,
    commitEdit,
    cancelEdit,
  }
}
