import { ImageIcon } from 'lucide-react'

type ThumbnailCellProps = {
  url: string | null | undefined
  /** Only decorative here — the row's own title column carries the accessible name. */
  alt?: string
}

/** A square product thumbnail, with a placeholder so rows without one keep their height. */
export function ThumbnailCell({ url, alt = '' }: ThumbnailCellProps) {
  if (!url) {
    return (
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted">
        <ImageIcon className="size-4 text-muted-foreground" />
      </div>
    )
  }

  return <img src={url} alt={alt} className="size-8 shrink-0 rounded-md border object-cover" />
}
