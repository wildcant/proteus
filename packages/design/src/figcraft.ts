// The headless FigCraft CLI, shared by every exporter's `--export`. Nothing else talks to FigCraft:
// the builds read only the committed snapshot.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import type { FigCraftLocation } from './config.ts'

type Step = { command: string; params: Record<string, unknown> }

/** Runs steps (JSON lines of {command, params}) on the design file, in one CLI call, and returns each result. */
type Run = (steps: Step[]) => unknown[]

/** Writes one layer to a file, through the CLI's `export`: SVG, or PNG at a scale. Its folder becomes a write root. */
type ExportNode = (id: string | number, path: string, format: 'svg' | 'png', scale?: number) => void

/**
 * Opens a work folder, hands `fn` a `run` and an `exportNode` on the design file, and removes the folder afterwards. The
 * CLI only reads and writes inside the roots it is given: the design file's folder, the work folder,
 * and `writeRoot` when a command writes a file itself (`variable.export`).
 */
export function withFigCraft<T>(
  location: FigCraftLocation,
  writeRoot: string | undefined,
  fn: (run: Run, exportNode: ExportNode) => T,
): T {
  const file = location.file
  if (!file) {
    throw new Error('no design file: set `file` in design.local.json (gitignored, beside design.json) or FIGCRAFT_FILE')
  }
  const work = mkdtempSync(join(tmpdir(), 'design-'))
  const roots = [
    ['--automation-read-root', dirname(file)],
    ['--automation-read-root', work],
    ...(writeRoot ? [['--automation-write-root', writeRoot]] : []),
  ].flat()
  const run: Run = (steps) => {
    const script = join(work, 'steps.jsonl')
    writeFileSync(script, steps.map((step) => JSON.stringify(step)).join('\n'))
    const output = execFileSync(location.cli, ['run', script, '--in', file, ...roots], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    })
    return output
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { command: string; ok: boolean; result: unknown })
      .map((step) => {
        if (!step.ok) throw new Error(`FigCraft ${step.command} failed: ${JSON.stringify(step)}`)
        return step.result
      })
  }
  const exportNode: ExportNode = (id, path, format, scale = 1) => {
    mkdirSync(dirname(path), { recursive: true })
    const args = ['export', file, '-o', path, '--format', format, '--scale', String(scale), '--node', String(id)]
    execFileSync(location.cli, [...args, ...roots, '--automation-write-root', dirname(path)], { stdio: 'ignore' })
  }
  try {
    return fn(run, exportNode)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}
