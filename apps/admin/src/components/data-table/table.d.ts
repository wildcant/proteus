import type { RowData } from '@tanstack/react-table'

// TanStack Table's ColumnMeta is an empty interface by design — extend it via
// declaration merging so we can pass align/truncateTooltip through the column
// pipeline without losing type safety.
declare module '@tanstack/react-table' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: declaration merging requires interface
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: 'left' | 'center' | 'right'
    truncateTooltip?: boolean
  }
}
