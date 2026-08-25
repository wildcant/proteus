import fs from 'node:fs/promises'
import path from 'node:path'
import type { SvgNode } from './types.ts'

export const readSvg = (svgFile: string, iconsDirectory: string): Promise<string> =>
  fs.readFile(path.join(iconsDirectory, svgFile), 'utf-8')

/**
 * Walk the asset tree and return paths relative to it. Assets are grouped into subdirectories
 * (`payment/`, `social/`), so a flat readdir would find nothing.
 */
export const readSvgDirectory = async (directory: string, extension = '.svg'): Promise<string[]> => {
  const entries = await fs.readdir(directory, { withFileTypes: true, recursive: true })

  return entries
    .filter((entry) => entry.isFile() && path.extname(entry.name) === extension)
    .map((entry) => path.relative(directory, path.join(entry.parentPath, entry.name)))
    .sort()
}

export const toPascalCase = (value: string): string =>
  value
    .split(/[^a-zA-Z0-9]+/g)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')

export const toCamelCase = (value: string): string => {
  const pascalCase = toPascalCase(value)

  return pascalCase.charAt(0).toLowerCase() + pascalCase.slice(1)
}

/** djb2, base36, truncated to 6 characters — stable across rebuilds because it hashes content. */
const hash = (value: string, seed = 5381): string => {
  let index = value.length
  let current = seed

  while (index) {
    current = (current * 33) ^ value.charCodeAt(--index)
  }

  return (current >>> 0).toString(36).slice(0, 6)
}

export const generateHashedKey = ({ name, attributes }: SvgNode): string => hash(JSON.stringify([name, attributes]))

export const hasDuplicatedChildren = (children: SvgNode[]): boolean => {
  const keys = children.map(generateHashedKey)

  return new Set(keys).size !== keys.length
}
