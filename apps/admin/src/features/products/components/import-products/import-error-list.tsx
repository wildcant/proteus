import { Trans } from '@lingui/react/macro'
import type { AdminProductImportError } from '#/api/generated/model'

/**
 * Every problem an import found, each with the CSV line it is on (the header is line 1) so the
 * merchant can go straight to it. The messages come from the server in English and are shown as-is.
 */
export function ImportErrorList({ errors }: { errors: AdminProductImportError[] }) {
  return (
    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-muted-foreground text-sm">
      {errors.map(({ line, handle, message }) => (
        <li key={`${line}:${handle ?? ''}:${message}`}>
          {handle ? (
            <Trans>
              Line {line} ({handle}): {message}
            </Trans>
          ) : (
            <Trans>
              Line {line}: {message}
            </Trans>
          )}
        </li>
      ))}
    </ul>
  )
}
