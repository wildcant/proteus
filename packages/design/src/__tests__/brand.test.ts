import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { type BrandEntry, type BrandFrame, brandProblems, packIco, readBrandFrames } from '../brand/build.ts'

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
      frame('favicon', 48, exportsTo('favicon.gif', 48)),
      frame('escape', 48, exportsTo('../src/escape.png', 48)),
      frame('icon', 48, exportsTo('icon.png', 48)),
      frame('icon', 48, exportsTo('icon.png', 48)),
    ])
    expect(problems).toEqual([
      'favicon (favicon): no pluginData {kind: "brandExport", file, px}',
      'touch (touch): named "touch", but its file is apple-touch-icon.png (name the frame like the file)',
      'logo512 (logo512): 500 × 500, not 512 × 512 (frames export at 1×)',
      'favicon (favicon): favicon.gif: only .png, .svg and .ico are exported',
      'escape (escape): ../src/escape.png: not a path inside the public folder',
      'icon.png is the target of two frames',
    ])
  })

  it('packs every frame that targets one .ico into that file, smallest first', () => {
    const { entries, problems } = readBrandFrames([
      frame('favicon', 32, exportsTo('favicon.ico', 32)),
      frame('favicon', 16, exportsTo('favicon.ico', 16)),
      frame('logo192', 192, exportsTo('logo192.png', 192)),
    ])
    expect(problems).toEqual([])
    expect(entries).toEqual([
      {
        id: 'favicon',
        name: 'favicon',
        file: 'favicon.ico',
        px: 32,
        format: 'ico',
        parts: [
          { id: 'favicon', px: 16 },
          { id: 'favicon', px: 32 },
        ],
      },
      { id: 'logo192', name: 'logo192', file: 'logo192.png', px: 192, format: 'png' },
    ])

    expect(
      readBrandFrames([
        frame('favicon', 16, exportsTo('favicon.ico', 16)),
        frame('favicon', 16, exportsTo('favicon.ico', 16)),
      ]).problems,
    ).toEqual(['favicon.ico has two frames at 16 px'])
  })

  it('writes an .ico of PNG images that a browser reads: a directory of sizes, then each PNG', () => {
    const small = png(16, 16)
    const large = png(256, 256)
    const ico = packIco([small, large])

    expect([ico.readUInt16LE(0), ico.readUInt16LE(2), ico.readUInt16LE(4)]).toEqual([0, 1, 2])
    const entry = (index: number) => {
      const at = 6 + 16 * index
      return {
        width: ico.readUInt8(at),
        height: ico.readUInt8(at + 1),
        planes: ico.readUInt16LE(at + 4),
        bitCount: ico.readUInt16LE(at + 6),
        bytes: ico.readUInt32LE(at + 8),
        offset: ico.readUInt32LE(at + 12),
      }
    }
    // 256 px is written as 0, as the format says.
    expect([entry(0), entry(1)]).toEqual([
      { width: 16, height: 16, planes: 1, bitCount: 32, bytes: 24, offset: 38 },
      { width: 0, height: 0, planes: 1, bitCount: 32, bytes: 24, offset: 62 },
    ])
    expect(ico.subarray(38, 62)).toEqual(small)
    expect(ico.subarray(62)).toEqual(large)
  })

  it('checks an .ico holds the sizes the last export packed', () => {
    const ico = packIco([png(16, 16), png(32, 32)])
    const entry: BrandEntry = {
      name: 'favicon',
      file: 'favicon.ico',
      px: 32,
      format: 'ico',
      sizes: [16, 32],
      sha256: sha256(ico),
    }

    expect(brandProblems([entry], () => ico)).toEqual([])
    expect(brandProblems([{ ...entry, sizes: [16, 24, 32] }], () => ico)).toEqual([
      'favicon.ico: 16, 32 px, not 16, 24, 32 px',
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
