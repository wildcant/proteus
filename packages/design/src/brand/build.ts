// The `brand` page's `export` section -> the store's favicon and touch icons (docs/design/brand-marks.md). A port of
// Atope's brand script. Each direct child frame of the section is one file: its pluginData
// {kind: "brandExport", file, px} names the file inside the store's public folder and its pixel size, the frame
// is named like the file and sized at 1×. Several frames may target one `.ico`, one per size it holds (the
// favicon); they are packed into it smallest first. The export records each file's size and hash in the snapshot,
// so the check can tell a file edited or lost since the last export without opening the design file.
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

type Format = 'png' | 'svg' | 'ico'
/** One file. An `.ico` lists its frames in `parts`, smallest first; `id` and `px` are its largest. */
type Planned = { id: string; name: string; file: string; px: number; format: Format; parts?: Part[] }
type Part = { id: string; px: number }

/** One exported file, as the snapshot records it. `file` is inside the public folder; `sizes` are an `.ico`'s. */
export type BrandEntry = Omit<Planned, 'id' | 'parts'> & { sizes?: number[]; sha256: string }

const FORMATS: Record<string, Format> = { '.png': 'png', '.svg': 'svg', '.ico': 'ico' }
const EXTENSIONS = Object.keys(FORMATS)

/** The files the export frames become, and every frame that can't be exported (so one run lists them all). */
export function readBrandFrames(frames: BrandFrame[]): { entries: Planned[]; problems: string[] } {
  const problems: string[] = []
  const entries: Planned[] = []
  for (const frame of frames) {
    const target = readFrame(frame, (message) => problems.push(`${frame.name} (${frame.id}): ${message}`))
    if (!target) continue
    const { file, format, part } = target
    const existing = entries.find((entry) => entry.file === file)
    if (existing?.parts) {
      if (existing.parts.some((other) => other.px === part.px)) problems.push(`${file} has two frames at ${part.px} px`)
      else existing.parts.push(part)
    } else if (existing) {
      problems.push(`${file} is the target of two frames`)
    } else if (format) {
      const entry: Planned = { id: part.id, name: frame.name, file, px: part.px, format }
      entries.push(format === 'ico' ? { ...entry, parts: [part] } : entry)
    }
  }
  for (const entry of entries) {
    if (!entry.parts) continue
    entry.parts.sort((a, b) => a.px - b.px)
    Object.assign(entry, entry.parts.at(-1))
  }
  return { entries, problems }
}

/** One frame's target file, reporting what is wrong with it; undefined when it names no file at all. */
function readFrame(frame: BrandFrame, fail: (message: string) => void) {
  if (frame.type !== 'FRAME') {
    fail(`a ${frame.type}, not a frame`)
    return undefined
  }
  const { kind, file, px } = frame.pluginData ?? {}
  if (kind !== 'brandExport' || !file || !px) {
    fail('no pluginData {kind: "brandExport", file, px}')
    return undefined
  }
  const format: Format | undefined = FORMATS[extname(file)]
  if (!format) fail(`${file}: only ${EXTENSIONS.slice(0, -1).join(', ')} and ${EXTENSIONS.at(-1)} are exported`)
  if (isAbsolute(file) || normalize(file).startsWith('..')) fail(`${file}: not a path inside the public folder`)
  if (frame.name !== basename(file, extname(file))) {
    fail(`named "${frame.name}", but its file is ${file} (name the frame like the file)`)
  }
  if (frame.width !== Number(px) || frame.height !== Number(px)) {
    fail(`${frame.width} × ${frame.height}, not ${px} × ${px} (frames export at 1×)`)
  }
  return { file, format, part: { id: frame.id, px: Number(px) } }
}

/** An `.ico` of PNG images, in the order given: the header, one directory entry per image, then the images. */
export function packIco(pngs: Buffer[]): Buffer {
  const header = Buffer.alloc(6 + 16 * pngs.length)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(pngs.length, 4)
  let offset = header.length
  pngs.forEach((image, index) => {
    const size = pngSize(image)
    const at = 6 + 16 * index
    // A byte holds the size; 256 px is written as 0.
    header.writeUInt8((size?.width ?? 0) % 256, at)
    header.writeUInt8((size?.height ?? 0) % 256, at + 1)
    header.writeUInt16LE(1, at + 4)
    header.writeUInt16LE(32, at + 6)
    header.writeUInt32LE(image.length, at + 8)
    header.writeUInt32LE(offset, at + 12)
    offset += image.length
  })
  return Buffer.concat([header, ...pngs])
}

/** Each recorded file against what is on disk (`read` returns undefined for a missing file). */
export function brandProblems(entries: BrandEntry[], read: (file: string) => Buffer | undefined): string[] {
  return entries.flatMap(({ file, px, format, sizes, sha256 }) => {
    const bytes = read(file)
    if (!bytes) return [`${file}: missing`]
    const changed = hash(bytes) === sha256 ? [] : [`${file}: changed since the last brand:export`]
    if (format === 'ico') {
      const packed = icoSizes(bytes)
      const expected = sizes ?? [px]
      if (packed.join() === expected.join()) return changed
      return [`${file}: ${packed.join(', ')} px, not ${expected.join(', ')} px`, ...changed]
    }
    const size = format === 'png' ? pngSize(bytes) : svgSize(bytes)
    return [
      ...(size?.width === px && size.height === px
        ? []
        : [`${file}: ${size ? `${size.width} × ${size.height}` : 'unreadable size'}, not ${px} × ${px}`]),
      ...changed,
    ]
  })
}

export const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

// The IHDR chunk comes first in every PNG: width and height are big-endian at bytes 16 and 20.
function pngSize(bytes: Buffer) {
  if (bytes.length < 24 || bytes.toString('latin1', 12, 16) !== 'IHDR') return undefined
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

// Each 16-byte directory entry after the 6-byte header starts with the width (0 for 256).
function icoSizes(bytes: Buffer) {
  if (bytes.length < 6 || bytes.readUInt16LE(2) !== 1) return []
  return Array.from({ length: bytes.readUInt16LE(4) }, (_, index) => bytes.readUInt8(6 + 16 * index) || 256)
}

function svgSize(bytes: Buffer) {
  const viewBox = /<svg[^>]*\sviewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(bytes.toString('utf8'))
  return viewBox ? { width: Number(viewBox[1]), height: Number(viewBox[2]) } : undefined
}
