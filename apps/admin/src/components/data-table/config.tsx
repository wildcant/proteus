import { formatDate, formatDatetime } from '@proteus/utils'
import { ThumbnailCell } from '#/components/data-table/data-table-ui/thumbnail-cell'
import { configureDataTable } from '#/components/data-table/utils/configure'

export function setupDataTable() {
  configureDataTable({
    renderers: {
      text: ({ value }) => (value != null ? String(value) : ''),
      datetime: ({ value }) => {
        if (!value || typeof value === 'boolean') return ''
        return formatDatetime(value)
      },
      date: ({ value }) => {
        if (!value || typeof value === 'boolean') return ''
        return formatDate(value)
      },
      boolean: ({ value }) => (value ? 'Yes' : 'No'),
      thumbnail: ({ value }) => <ThumbnailCell url={typeof value === 'string' ? value : null} />,
    },
  })
}
