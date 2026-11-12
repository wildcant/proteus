// The icon half of the snapshot: one `figcraft/icons/<name>.svg` per variant of the Icon set, as FigCraft's CLI
// exports it. Each variant is named `name=<kebab-case>` and clipped to its 24 × 24 frame.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import type { ResolvedConfig } from '../config.ts'
import { withFigCraft } from '../figcraft.ts'

const ICONS_DIR = 'icons'

/** Variant name -> its SVG. */
export function readIconSnapshot(snapshot: string): Map<string, string> {
  const dir = join(snapshot, ICONS_DIR)
  if (!existsSync(dir)) return new Map()
  return new Map(
    readdirSync(dir)
      .filter((file) => file.endsWith('.svg'))
      .sort()
      .map((file) => [file.slice(0, -'.svg'.length), readFileSync(join(dir, file), 'utf8')]),
  )
}

type ListedComponent = { id: string; name: string; type: string }
type FigCraftNode = { id: string; name: string; children?: FigCraftNode[] }

/** Replaces `figcraft/icons/` with the set's variants. Without the set, the folder goes: no glyphs yet. */
export function exportIconSnapshot(config: ResolvedConfig) {
  const icons = config.icons
  if (!icons) throw new Error('design.json has no `icons` section')
  const dir = join(config.snapshot, ICONS_DIR)
  rmSync(dir, { recursive: true, force: true })
  withFigCraft(config.figcraft, undefined, (run, exportNode) => {
    const [list] = run([{ command: 'component.list', params: {} }]) as [ListedComponent[]]
    const sets = list.filter((c) => c.type === 'COMPONENT_SET' && c.name === icons.set)
    if (sets.length > 1) throw new Error(`expected one component set named "${icons.set}", found ${sets.length}`)
    const [found] = sets
    if (!found) {
      console.info(`no component set "${icons.set}" in the design file: no glyphs`)
      return
    }
    const [set] = run([{ command: 'node.get', params: { id: found.id } }]) as [FigCraftNode]
    mkdirSync(dir, { recursive: true })
    for (const variant of set.children ?? []) {
      const name = /^name=([a-z0-9-]+)$/.exec(variant.name)?.[1]
      if (!name) throw new Error(`${icons.set} variant "${variant.name}" is not named name=<kebab-case>`)
      exportNode(variant.id, join(dir, `${name}.svg`), 'svg')
    }
    console.info(`exported ${set.children?.length ?? 0} icon(s)`)
  })
}
