import type { IconNode } from '../types.ts'

/** The subset of svgson's parse output this tool reads. */
export type SvgNode = {
  name: string
  type: string
  value: string
  attributes: Record<string, string>
  children: SvgNode[]
}

export type ParsedIcon = {
  /** Text of the source `<title>`, e.g. `American Express`. Kept for documentation only. */
  label: string
  children: SvgNode[]
}

export type IconsObject = Record<string, ParsedIcon>

export type ExportTemplateOptions = {
  componentName: string
  iconName: string
  label: string
  children: IconNode
  getSvg: () => Promise<string>
}

export type ExportTemplate = (options: ExportTemplateOptions) => Promise<string>

export type GenerateIconFilesOptions = {
  iconNodes: IconsObject
  outputDirectory: string
  template: ExportTemplate
  iconFileExtension: string
  iconsDirectory: string
  svgFiles: string[]
  showLog?: boolean
}

export type GenerateExportsFileOptions = {
  iconNodes: IconsObject
  outputDirectory: string
  exportFileName: string
  exportModuleNameCasing: 'camel' | 'pascal'
  exportNameSuffix: string
  importFileExtension: string
  showLog?: boolean
}
