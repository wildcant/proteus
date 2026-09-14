/**
 * The app's own stylesheet, in the browser the component tests run in.
 *
 * Not decoration. Base UI's radio is an empty `<span>` sized entirely by `size-4`, so without
 * Tailwind it has a zero bounding box and every `toBeVisible()` fails on a control that is
 * perfectly present. Loading the real stylesheet also means these tests judge visibility the way a
 * shopper's browser does, rather than the way an unstyled document does.
 */
import { afterEach, beforeEach, expect, type MockInstance, vi } from 'vitest'
import './src/styles.css'

const LEVELS = ['error', 'warn'] as const

const complaints: string[] = []
let spies: MockInstance[] = []

/**
 * A component that warns while rendering fails the test that rendered it.
 *
 * React and Base UI both report a misused component through the console and nothing else — no
 * throw, no failed assertion, nothing the DOM shows. Left unwatched they accumulate: a duplicate
 * `key` and a link rendered through a button both shipped here behind a green suite.
 *
 * The e2e suites carry the same guard over whole pages, in
 * `packages/testing/fixtures/console-guard.ts`; this is the half that runs in `verify`.
 */
beforeEach(() => {
  complaints.length = 0
  spies = LEVELS.map((level) =>
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      // First line only: React appends an owner stack running to dozens of lines, which buries the
      // next complaint in the diff.
      complaints.push(`${level}: ${String(args[0]).split('\n')[0]}`)
    }),
  )
})

afterEach(() => {
  for (const spy of spies) {
    spy.mockRestore()
  }

  expect(complaints, 'the component logged warnings while rendering').toEqual([])
})
