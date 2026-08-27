import fs from 'node:fs/promises'
import path from 'node:path'
import { toCamelCase, toPascalCase } from '../helpers.ts'
import type { GenerateExportsFileOptions } from '../types.ts'

export const generateExportsFile = async ({
  iconNodes,
  outputDirectory,
  exportFileName,
  exportModuleNameCasing,
  exportNameSuffix,
  importFileExtension,
  showLog = true,
}: GenerateExportsFileOptions): Promise<void> => {
  const toModuleName = exportModuleNameCasing === 'camel' ? toCamelCase : toPascalCase

  // Built as one sorted string and written once — appending concurrently would leave the export
  // order up to whichever write landed first, and the file is committed.
  const contents = Object.keys(iconNodes)
    .sort()
    .map(
      (iconName) =>
        `export { ${toModuleName(iconName)}${exportNameSuffix} } from './${iconName}${importFileExtension}'\n`,
    )
    .join('')

  await fs.writeFile(path.join(outputDirectory, 'icons', exportFileName), contents, 'utf-8')

  if (showLog) {
    console.info(`Successfully generated icons/${exportFileName}.`)
  }
}
