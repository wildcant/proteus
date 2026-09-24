import { Trans } from '@lingui/react/macro'
import { formatDate, formatDatetime } from '@proteus/utils'
import { ThumbnailCell } from '#/components/data-table/data-table-ui/thumbnail-cell'
import { configureDataTable } from '#/components/data-table/utils/configure'
import { dateLocale } from '#/lib/i18n/locale'

export function setupDataTable() {
  configureDataTable({
    renderers: {
      text: ({ value }) => (value != null ? String(value) : ''),
      datetime: ({ value }) => {
        if (!value || typeof value === 'boolean') return ''
        return formatDatetime(value, dateLocale())
      },
      date: ({ value }) => {
        if (!value || typeof value === 'boolean') return ''
        return formatDate(value, dateLocale())
      },
      boolean: ({ value }) => (value ? <Trans>Yes</Trans> : <Trans>No</Trans>),
      thumbnail: ({ value }) => <ThumbnailCell url={typeof value === 'string' ? value : null} />,
    },
  })
}
