import { test } from '@tests/setup/test-extend.js'
import { buildOptionSwatches } from '../utils/build-option-swatches.js'

// camelCase ids rather than the DB's prefixed form: they appear as object keys here, which the
// naming convention governs, and nothing in the rule under test reads their shape.
const colour = { id: 'optColour', values: [{ id: 'valRed' }, { id: 'valBlue' }] }
const images = [
  { id: 'imgRed', url: 'https://cdn.test/red.jpg' },
  { id: 'imgBlue', url: 'https://cdn.test/blue.jpg' },
]

test.describe('buildOptionSwatches', () => {
  test('a value shows the first image of the first variant carrying it', ({ expect }) => {
    const swatches = buildOptionSwatches(
      [colour],
      [
        { optionValues: { optColour: 'valRed' }, imageIds: ['imgRed', 'imgBlue'] },
        { optionValues: { optColour: 'valBlue' }, imageIds: ['imgBlue'] },
      ],
      images,
    )

    expect(swatches).toEqual({ valRed: 'https://cdn.test/red.jpg', valBlue: 'https://cdn.test/blue.jpg' })
  })

  test('a value no shipped variant carries has no swatch', ({ expect }) => {
    const swatches = buildOptionSwatches(
      [colour],
      [{ optionValues: { optColour: 'valRed' }, imageIds: ['imgRed'] }],
      images,
    )

    expect(swatches.valBlue).toBeNull()
  })

  test('a carrier with no images has no swatch', ({ expect }) => {
    const swatches = buildOptionSwatches([colour], [{ optionValues: { optColour: 'valRed' }, imageIds: [] }], images)

    expect(swatches.valRed).toBeNull()
  })

  test('an image the response never sent is not linked', ({ expect }) => {
    const swatches = buildOptionSwatches(
      [colour],
      [{ optionValues: { optColour: 'valRed' }, imageIds: ['imgMissing'] }],
      images,
    )

    expect(swatches.valRed).toBeNull()
  })

  test('values of different options share one flat map', ({ expect }) => {
    const size = { id: 'optSize', values: [{ id: 'valM' }] }
    const swatches = buildOptionSwatches(
      [colour, size],
      [{ optionValues: { optColour: 'valRed', optSize: 'valM' }, imageIds: ['imgRed'] }],
      images,
    )

    expect(swatches).toEqual({
      valRed: 'https://cdn.test/red.jpg',
      valBlue: null,
      valM: 'https://cdn.test/red.jpg',
    })
  })
})
