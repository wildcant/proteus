// The `brand` page's `export` section -> the store's favicon and touch icons (docs/design/brand-marks.md). A port of
// Atope's brand script. Each direct child frame of the section is one file: its pluginData
// {kind: "brandExport", file, px} names the file inside the store's public folder and its pixel size, the frame
// is named like the file and sized at 1×. The export records each file's size and hash in the snapshot, so the
// check can tell a file edited or lost since the last export without opening the design file.
import { createHash } from 'node:crypto'
import { basename, extname, isAbsolute, normalize } from 'node:path'

/** What the export reads of one frame of the `export` section. */
export type BrandFrame = {
  id: string
  name: string
  type: string
  width: number
  height: number
  pluginData?: Record<string, string>
}

type Format = 'png' | 'svg'
type Planned = { id: string; name: string; file: string; px: number; format: Format }

/** One exported file, as the snapshot records it. `file` is inside the public folder. */
export type BrandEntry = Omit<Planned, 'id'> & { sha256: string }

const FORMATS: Record<string, Format> = { '.png': 'png', '.svg': 'svg' }

/** The files the export frames become, and every frame that can't be exported (so one run lists them all). */
export function readBrandFrames(frames: BrandFrame[]): { entries: Planned[]; problems: string[] } {
  const problems: string[] = []
  const entries: Planned[] = []
  for (const frame of frames) {
    const fail = (message: string) => problems.push(`${frame.name} (${frame.id}): ${message}`)
    if (frame.type !== 'FRAME') {
      fail(`a ${frame.type}, not a frame`)
      continue
    }
    const { kind, file, px } = frame.pluginData ?? {}
    if (kind !== 'brandExport' || !file || !px) {
      fail('no pluginData {kind: "brandExport", file, px}')
      continue
    }
    const format = FORMATS[extname(file)]
    if (!format) fail(`${file}: only ${Object.keys(FORMATS).join(' and ')} are exported`)
    if (isAbsolute(file) || normalize(file).startsWith('..')) fail(`${file}: not a path inside the public folder`)
    if (frame.name !== basename(file, extname(file))) {
      fail(`named "${frame.name}", but its file is ${file} (name the frame like the file)`)
    }
    if (frame.width !== Number(px) || frame.height !== Number(px)) {
      fail(`${frame.width} × ${frame.height}, not ${px} × ${px} (frames export at 1×)`)
    }
    if (entries.some((entry) => entry.file === file)) {
      problems.push(`${file} is the target of two frames`)
      continue
    }
    if (format) entries.push({ id: frame.id, name: frame.name, file, px: Number(px), format })
  }
  return { entries, problems }
}

/** Each recorded file against what is on disk (`read` returns undefined for a missing file). */
export function brandProblems(entries: BrandEntry[], read: (file: string) => Buffer | undefined): string[] {
  return entries.flatMap(({ file, px, format, sha256 }) => {
    const bytes = read(file)
    if (!bytes) return [`${file}: missing`]
    const size = format === 'png' ? pngSize(bytes) : svgSize(bytes)
    return [
      ...(size?.width === px && size.height === px
        ? []
        : [`${file}: ${size ? `${size.width} × ${size.height}` : 'unreadable size'}, not ${px} × ${px}`]),
      ...(hash(bytes) === sha256 ? [] : [`${file}: changed since the last brand:export`]),
    ]
  })
}

export const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

// The IHDR chunk comes first in every PNG: width and height are big-endian at bytes 16 and 20.
function pngSize(bytes: Buffer) {
  if (bytes.length < 24 || bytes.toString('latin1', 12, 16) !== 'IHDR') return undefined
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

function svgSize(bytes: Buffer) {
  const viewBox = /<svg[^>]*\sviewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(bytes.toString('utf8'))
  return viewBox ? { width: Number(viewBox[1]), height: Number(viewBox[2]) } : undefined
}
