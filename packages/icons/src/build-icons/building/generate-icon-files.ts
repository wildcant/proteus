import fs from 'node:fs/promises'
import path from 'node:path'
import type { IconNode, SVGElementType } from '../../types.ts'
import { readSvg, toPascalCase } from '../helpers.ts'
import type { GenerateIconFilesOptions, SvgNode } from '../types.ts'

const toIconNode = (nodes: SvgNode[]): IconNode =>
  nodes.map((node) =>
    node.children.length > 0
      ? ([node.name as SVGElementType, node.attributes, toIconNode(node.children)] as const)
      : ([node.name as SVGElementType, node.attributes] as const),
  ) as IconNode

export const generateIconFiles = async ({
  iconNodes,
  outputDirectory,
  template,
  iconFileExtension,
  iconsDirectory,
  svgFiles,
  showLog = true,
}: GenerateIconFilesOptions): Promise<void> => {
  const iconsDistDirectory = path.join(outputDirectory, 'icons')
  await fs.mkdir(iconsDistDirectory, { recursive: true })

  const sourceByName = new Map(svgFiles.map((svgFile) => [path.basename(svgFile, '.svg'), svgFile]))
  const icons = Object.entries(iconNodes)

  await Promise.all(
    icons.map(async ([iconName, { label, children }]) => {
      const svgFile = sourceByName.get(iconName)

      if (!svgFile) {
        throw new Error(`No source file found for icon "${iconName}".`)
      }

      const contents = await template({
        componentName: toPascalCase(iconName),
        iconName,
        label,
        children: toIconNode(children),
        getSvg: () => readSvg(svgFile, iconsDirectory),
      })

      await fs.writeFile(path.join(iconsDistDirectory, `${iconName}${iconFileExtension}`), contents, 'utf-8')
    }),
  )

  if (showLog) {
    console.info(`Successfully built ${icons.length} icons.`)
  }
}
