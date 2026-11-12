// The brand half of the snapshot: `figcraft/brand.json`, what the last brand:export wrote into the public folder.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { ResolvedConfig } from '../config.ts'
import { withFigCraft } from '../figcraft.ts'
import { type BrandEntry, type BrandFrame, hash, packIco, readBrandFrames } from './build.ts'

const BRAND_FILE = 'brand.json'
const PAGE = 'brand'
const SECTION = 'export'

export function readBrandSnapshot(snapshot: string): BrandEntry[] {
  const path = join(snapshot, BRAND_FILE)
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as BrandEntry[]) : []
}

type FigCraftNode = BrandFrame & { type: string; children?: FigCraftNode[] }

/**
 * Exports every frame of the `export` section on page `brand` into the public folder at 1×, removes the files
 * no frame exports any more, and records the rest. Without a `brand` page nothing is exported.
 */
export function exportBrandSnapshot(config: ResolvedConfig) {
  const brand = config.brand
  if (!brand) throw new Error('design.json has no `brand` section')
  withFigCraft(config.figcraft, undefined, (run, exportNode) => {
    const [pages] = run([{ command: 'page.list', params: {} }]) as [{ id: string | number; name: string }[]]
    const found = pages.filter((p) => p.name === PAGE)
    if (found.length > 1) throw new Error(`expected one page named "${PAGE}", found ${found.length}`)
    let frames: FigCraftNode[] = []
    if (found[0]) {
      const [page] = run([{ command: 'node.get', params: { id: found[0].id } }]) as [FigCraftNode]
      const sections = (page.children ?? []).filter((c) => c.type === 'SECTION' && c.name === SECTION)
      if (sections.length !== 1) throw new Error(`expected one section named "${SECTION}" on page "${PAGE}"`)
      const [section] = run([{ command: 'node.get', params: { id: sections[0]?.id } }]) as [FigCraftNode]
      frames = run(
        (section.children ?? []).map((c) => ({ command: 'node.get', params: { id: c.id } })),
      ) as FigCraftNode[]
    }
    const { entries, problems } = readBrandFrames(frames)
    if (problems.length) throw new Error(`page "${PAGE}" can't be exported:\n  ${problems.join('\n  ')}`)

    for (const old of readBrandSnapshot(config.snapshot)) {
      if (!entries.some((entry) => entry.file === old.file)) rmSync(join(brand.output, old.file), { force: true })
    }
    const recorded: BrandEntry[] = entries.map(({ id, parts, ...entry }) => {
      const path = join(brand.output, entry.file)
      if (!parts) {
        exportNode(id, path, entry.format === 'svg' ? 'svg' : 'png')
        return { ...entry, sha256: hash(readFileSync(path)) }
      }
      // Each size of an .ico is its own frame, exported as a PNG and packed.
      const work = mkdtempSync(join(tmpdir(), 'brand-'))
      try {
        const pngs = parts.map((part) => {
          const png = join(work, `${part.px}.png`)
          exportNode(part.id, png, 'png')
          return readFileSync(png)
        })
        writeFileSync(path, packIco(pngs))
      } finally {
        rmSync(work, { recursive: true, force: true })
      }
      return { ...entry, sizes: parts.map((part) => part.px), sha256: hash(readFileSync(path)) }
    })
    const manifest = join(config.snapshot, BRAND_FILE)
    if (recorded.length) writeFileSync(manifest, `${JSON.stringify(recorded, null, 2)}\n`)
    else rmSync(manifest, { force: true })
    console.info(
      found[0] ? `exported ${recorded.length} brand file(s)` : `no page "${PAGE}" in the design file: nothing exported`,
    )
  })
}
