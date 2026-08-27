#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import getArgumentOptions from 'minimist'
import { generateExportsFile } from './building/generate-exports-file.ts'
import { generateIconFiles } from './building/generate-icon-files.ts'
import { readSvgDirectory } from './helpers.ts'
import { renderIconsObject } from './render/render-icons-object.ts'
import type { ExportTemplate } from './types.ts'

type CliArguments = {
  input?: string
  output?: string
  templateSrc?: string
  iconFileExtension?: string
  importFileExtension?: string
  exportFileName?: string
  exportModuleNameCasing?: 'camel' | 'pascal'
  exportNameSuffix?: string
  renderUniqueKey?: boolean
  silent?: boolean
}

const {
  input = './assets',
  output = '.',
  templateSrc,
  iconFileExtension = '.ts',
  importFileExtension = '',
  exportFileName = 'index.ts',
  exportModuleNameCasing = 'pascal',
  exportNameSuffix = '',
  renderUniqueKey = false,
  silent = false,
} = getArgumentOptions(process.argv.slice(2)) as CliArguments

const buildIcons = async () => {
  if (!templateSrc) {
    throw new Error('No `templateSrc` argument given.')
  }

  const iconsDirectory = path.resolve(process.cwd(), input)
  const outputDirectory = path.resolve(process.cwd(), output)

  await fs.mkdir(outputDirectory, { recursive: true })

  const svgFiles = await readSvgDirectory(iconsDirectory)

  if (!svgFiles.length) {
    throw new Error(`No SVG assets found in ${iconsDirectory}.`)
  }

  const iconNodes = await renderIconsObject(svgFiles, iconsDirectory, renderUniqueKey)
  const { exportTemplate } = (await import(path.resolve(process.cwd(), templateSrc))) as {
    exportTemplate: ExportTemplate
  }

  await generateIconFiles({
    iconNodes,
    outputDirectory,
    template: exportTemplate,
    iconFileExtension,
    iconsDirectory,
    svgFiles,
    showLog: !silent,
  })

  await generateExportsFile({
    iconNodes,
    outputDirectory,
    exportFileName,
    exportModuleNameCasing,
    exportNameSuffix,
    importFileExtension,
    showLog: !silent,
  })
}

try {
  await buildIcons()
} catch (error) {
  console.error(error)
  // Without this the generator reports success on a thrown validation error and CI stays green.
  process.exitCode = 1
}
