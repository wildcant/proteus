import { cn } from '@proteus/ui'
import { DownloadIcon } from 'lucide-react'
import { type ChangeEvent, type DragEvent, useRef, useState } from 'react'
import { DEFAULT_MAX_FILE_SIZE } from './constants.ts'

export type FileType = {
  id: string
  url: string
  file: File
}

export type RejectedFile = {
  file: File
  reason: 'size'
}

type FileUploadProps = {
  /** Applied to the drop zone button so a `<label htmlFor>` can point at it. */
  id?: string
  label: string
  hint?: string
  multiple?: boolean
  hasError?: boolean
  /** Accepted MIME types, passed through to the file picker's `accept`. */
  formats: string[]
  /** In bytes. Pass `Number.POSITIVE_INFINITY` to disable the check. */
  maxFileSize?: number
  onUploaded: (files: FileType[], rejectedFiles: RejectedFile[]) => void
}

export function FileUpload({
  id,
  label,
  hint,
  multiple = true,
  hasError,
  formats,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  onUploaded,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLButtonElement>(null)

  const handleOpenFileSelector = () => {
    inputRef.current?.click()
  }

  const handleDragEnter = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()

    if (!event.dataTransfer?.files) {
      return
    }

    setIsDragOver(true)
  }

  const handleDragLeave = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()

    // Moving the pointer onto a child element also fires dragleave on the drop zone;
    // only a pointer that actually left the zone should clear the highlight.
    const dropZone = dropZoneRef.current
    if (dropZone && event.relatedTarget instanceof Node && dropZone.contains(event.relatedTarget)) {
      return
    }

    setIsDragOver(false)
  }

  const handleUploaded = (fileList: FileList | null | undefined) => {
    if (!fileList) {
      return
    }

    const files: FileType[] = []
    const rejectedFiles: RejectedFile[] = []

    for (const file of Array.from(fileList)) {
      if (file.size > maxFileSize) {
        rejectedFiles.push({ file, reason: 'size' })
        continue
      }

      files.push({
        id: Math.random().toString(36).substring(7),
        url: URL.createObjectURL(file),
        file,
      })
    }

    onUploaded(files, rejectedFiles)
  }

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()

    setIsDragOver(false)

    handleUploaded(event.dataTransfer?.files)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleUploaded(event.target.files)

    // Without this, picking the same file twice in a row is a no-op because the
    // input's value never changes and `change` never fires again.
    event.target.value = ''
  }

  return (
    <div>
      <button
        id={id}
        ref={dropZoneRef}
        type="button"
        onClick={handleOpenFileSelector}
        onDrop={handleDrop}
        onDragOver={(event) => event.preventDefault()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        className={cn(
          'group flex w-full flex-col items-center gap-y-2 rounded-lg border border-border border-dashed bg-muted/40 p-8 outline-none transition-colors',
          'hover:border-primary focus-visible:border-primary focus-visible:border-solid focus-visible:ring-3 focus-visible:ring-ring/50',
          {
            'border-destructive': hasError,
            'border-primary': isDragOver,
          },
        )}
      >
        <div className="flex items-center gap-x-2 text-muted-foreground text-sm group-disabled:opacity-50">
          <DownloadIcon className="size-4" />
          <span>{label}</span>
        </div>
        {!!hint && <span className="text-muted-foreground text-xs group-disabled:opacity-50">{hint}</span>}
      </button>
      <input
        hidden
        ref={inputRef}
        onChange={handleFileChange}
        type="file"
        accept={formats.join(',')}
        multiple={multiple}
      />
    </div>
  )
}
