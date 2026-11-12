import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { type BrandEntry, type BrandFrame, brandProblems, readBrandFrames } from '../brand/build.ts'

const frame = (name: string, size: number, pluginData?: Record<string, string>): BrandFrame => ({
  id: name,
  name,
  type: 'FRAME',
  width: size,
  height: size,
  ...(pluginData ? { pluginData } : {}),
})
const exportsTo = (file: string, px: number) => ({ kind: 'brandExport', file, px: String(px) })

/** The first 24 bytes of a PNG: the signature, then the IHDR chunk with the width and height. */
function png(width: number, height: number) {
  const bytes = Buffer.alloc(24)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0)
  bytes.writeUInt32BE(13, 8)
  bytes.write('IHDR', 12, 'latin1')
  bytes.writeUInt32BE(width, 16)
  bytes.writeUInt32BE(height, 20)
  return bytes
}
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

describe('brand', () => {
  it('reads each export frame as the file it becomes in the public folder, at its pixel size', () => {
    const { entries, problems } = readBrandFrames([
      frame('favicon', 48, exportsTo('favicon.png', 48)),
      frame('apple-touch-icon', 180, exportsTo('apple-touch-icon.png', 180)),
      frame('mark', 32, exportsTo('mark.svg', 32)),
    ])
    expect(problems).toEqual([])
    expect(entries).toEqual([
      { id: 'favicon', name: 'favicon', file: 'favicon.png', px: 48, format: 'png' },
      { id: 'apple-touch-icon', name: 'apple-touch-icon', file: 'apple-touch-icon.png', px: 180, format: 'png' },
      { id: 'mark', name: 'mark', file: 'mark.svg', px: 32, format: 'svg' },
    ])
  })

  it('names every frame it cannot export, in one run', () => {
    const { problems } = readBrandFrames([
      frame('favicon', 48),
      frame('touch', 180, exportsTo('apple-touch-icon.png', 180)),
      frame('logo512', 500, exportsTo('logo512.png', 512)),
      frame('favicon', 48, exportsTo('favicon.ico', 48)),
      frame('escape', 48, exportsTo('../src/escape.png', 48)),
      frame('icon', 48, exportsTo('icon.png', 48)),
      frame('icon', 48, exportsTo('icon.png', 48)),
    ])
    expect(problems).toEqual([
      'favicon (favicon): no pluginData {kind: "brandExport", file, px}',
      'touch (touch): named "touch", but its file is apple-touch-icon.png (name the frame like the file)',
      'logo512 (logo512): 500 × 500, not 512 × 512 (frames export at 1×)',
      'favicon (favicon): favicon.ico: only .png and .svg are exported',
      'escape (escape): ../src/escape.png: not a path inside the public folder',
      'icon.png is the target of two frames',
    ])
  })

  it('checks each exported file is there, at its size, and as the last export wrote it', () => {
    const favicon = png(48, 48)
    const touch = png(180, 180)
    const manifest: BrandEntry[] = [
      { name: 'favicon', file: 'favicon.png', px: 48, format: 'png', sha256: sha256(favicon) },
      { name: 'apple-touch-icon', file: 'apple-touch-icon.png', px: 180, format: 'png', sha256: sha256(touch) },
      { name: 'logo512', file: 'logo512.png', px: 512, format: 'png', sha256: sha256(png(512, 512)) },
      { name: 'logo192', file: 'logo192.png', px: 192, format: 'png', sha256: sha256(png(192, 192)) },
    ]
    const onDisk = new Map([
      ['favicon.png', favicon],
      // Edited by hand after the export.
      ['apple-touch-icon.png', Buffer.concat([touch, Buffer.from([0])])],
      ['logo512.png', png(256, 256)],
    ])

    expect(brandProblems(manifest, (file) => onDisk.get(file))).toEqual([
      'apple-touch-icon.png: changed since the last brand:export',
      'logo512.png: 256 × 256, not 512 × 512',
      'logo512.png: changed since the last brand:export',
      'logo192.png: missing',
    ])
    expect(brandProblems([], () => undefined)).toEqual([])
  })
})
