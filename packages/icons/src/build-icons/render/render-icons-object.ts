import path from 'node:path'
import { parseSync } from 'svgson'
import { generateHashedKey, hasDuplicatedChildren, readSvg } from '../helpers.ts'
import type { IconsObject, SvgNode } from '../types.ts'

/**
 * Parse every asset into `{ <name>: { label, children } }`.
 *
 * `camelcase` hands back React-ready attribute names (`clip-path` becomes `clipPath`), and the
 * source `<title>` is lifted out rather than kept as a child: svgson models its text as a nested
 * text node, and the icon-node tuple has nowhere to put that, so rendering it would emit an empty
 * `<title>` and hand every mark a blank accessible name.
 */
export const renderIconsObject = async (
  svgFiles: string[],
  iconsDirectory: string,
  renderUniqueKey = false,
): Promise<IconsObject> => {
  const icons = await Promise.all(
    svgFiles.map(async (svgFile) => {
      const name = path.basename(svgFile, '.svg')
      const contents = parseSync(await readSvg(svgFile, iconsDirectory), { camelcase: true }) as unknown as SvgNode

      if (!contents.children?.length) {
        throw new Error(`${svgFile} has no children.`)
      }

      const label = contents.children.find((child) => child.name === 'title')?.children[0]?.value ?? ''
      let children = contents.children.filter((child) => child.name !== 'title')

      if (!children.length) {
        throw new Error(`${svgFile} has no drawable children.`)
      }

      if (hasDuplicatedChildren(children)) {
        throw new Error(`Duplicated children in ${svgFile}.`)
      }

      if (renderUniqueKey) {
        children = children.map((child) => ({
          ...child,
          attributes: { ...child.attributes, key: generateHashedKey(child) },
        }))
      }

      return { name, svgFile, icon: { label, children } }
    }),
  )

  return icons.reduce<IconsObject>((accumulator, { name, svgFile, icon }) => {
    // Output is flat, so two assets sharing a basename across subdirectories would silently
    // overwrite each other.
    if (name in accumulator) {
      throw new Error(`Duplicate icon name "${name}" — ${svgFile} collides with another asset.`)
    }

    accumulator[name] = icon

    return accumulator
  }, {})
}
