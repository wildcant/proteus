// The FigCraft exports the tokens are built from: `variable.export` (the variables JSON, same shape as
// Figma's REST `GET /v1/files/:key/variables/local`) and `style.list` (the text styles). Both are
// committed, so the build runs on any machine and in CI without FigCraft.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import type { ResolvedConfig } from './config.ts'

export type Rgba = { r: number; g: number; b: number; a: number }
type Alias = { type: 'VARIABLE_ALIAS'; id: string }
export type VariableValue = Rgba | Alias | number | string | boolean

export type Variable = {
  id: string
  name: string
  description: string
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN'
  variableCollectionId: string
  valuesByMode: Record<string, VariableValue>
}

type VariableCollection = {
  id: string
  name: string
  defaultModeId: string
  modes: { modeId: string; name: string }[]
  variableIds: string[]
}

export type TextStyle = {
  id: string
  name: string
  description: string
  bound?: { fontFamily?: string; fontSize?: string; lineHeight?: string; letterSpacing?: string }
  style: {
    fontFamily: string
    fontStyle: string
    fontSize: number
    case: 'original' | 'upper' | 'lower' | 'title' | 'smallCaps'
    letterSpacing: { unit: 'percent' | 'pixels'; value: number }
    lineHeight: { unit: 'percent' | 'pixels' | 'auto'; value?: number }
  }
}

export type Snapshot = {
  collections: Record<string, VariableCollection>
  variables: Record<string, Variable>
  textStyles: TextStyle[]
}

const VARIABLES_FILE = 'variables.json'
const TEXT_STYLES_FILE = 'text-styles.json'

export function readSnapshot(dir: string): Snapshot {
  const { meta } = JSON.parse(readFileSync(join(dir, VARIABLES_FILE), 'utf8'))
  const rawStyles = JSON.parse(readFileSync(join(dir, TEXT_STYLES_FILE), 'utf8')) as RawTextStyle[]
  return { collections: meta.variableCollections, variables: meta.variables, textStyles: rawStyles.map(fromFigCraft) }
}

// style.list writes the style fields in snake_case; everything past this point uses camelCase.
type RawTextStyle = Omit<TextStyle, 'style'> & { style: Record<string, unknown> }

function fromFigCraft({ style, ...textStyle }: RawTextStyle): TextStyle {
  return {
    ...textStyle,
    style: {
      fontFamily: style.font_family as string,
      fontStyle: style.font_style as string,
      fontSize: style.font_size as number,
      case: style.case as TextStyle['style']['case'],
      letterSpacing: style.letter_spacing as TextStyle['style']['letterSpacing'],
      lineHeight: style.line_height as TextStyle['style']['lineHeight'],
    },
  }
}

/** Runs the headless FigCraft CLI on the design file and writes the snapshot. */
export function exportSnapshot(config: ResolvedConfig) {
  const file = config.file
  if (!file) {
    throw new Error(
      'no design file: set `file` in design-tokens.local.json (gitignored, beside design-tokens.json) or FIGCRAFT_FILE',
    )
  }
  mkdirSync(config.snapshot, { recursive: true })
  const work = mkdtempSync(join(tmpdir(), 'design-tokens-'))
  try {
    const script = join(work, 'export.jsonl')
    const steps = [
      { command: 'variable.export', params: { format: 'json', path: join(config.snapshot, VARIABLES_FILE) } },
      { command: 'style.list', params: { type: 'text' } },
    ]
    writeFileSync(script, steps.map((step) => JSON.stringify(step)).join('\n'))
    // The CLI only reads and writes inside the roots it is given: the design folder, the work folder
    // and the snapshot folder.
    const roots = [
      ['--automation-read-root', dirname(file)],
      ['--automation-read-root', work],
      ['--automation-write-root', config.snapshot],
    ].flat()
    const output = execFileSync(config.cli, ['run', script, '--in', file, ...roots], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
    const results = output
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { command: string; ok: boolean; result: unknown })
    const failed = results.find((step) => !step.ok)
    if (failed) throw new Error(`FigCraft ${failed.command} failed: ${JSON.stringify(failed)}`)
    const textStyles = results.find((step) => step.command === 'style.list')?.result
    writeFileSync(join(config.snapshot, TEXT_STYLES_FILE), `${JSON.stringify(textStyles, null, 2)}\n`)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}
