import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { ToolbarHeading } from './toolbar-heading'

/**
 * `DataTable`'s `description` is an additive prop on a component a dozen lists already use, so the
 * claim worth testing has two halves: it renders when passed, and a table that does not pass it
 * produces exactly the markup it produced before the prop existed.
 *
 * Rendered to a static string rather than into a DOM — this is markup, not behaviour, and the
 * admin's unit suite runs in node.
 */
const render = (props: { heading?: string; description?: string }) =>
  renderToStaticMarkup(createElement(ToolbarHeading, props))

describe('ToolbarHeading', () => {
  test('renders the description under the heading when one is given', () => {
    const markup = render({
      heading: 'Regions',
      description: 'A region is an area that you sell products in.',
    })

    expect(markup).toContain('Regions')
    expect(markup).toContain('A region is an area that you sell products in.')
    // Under the heading, not beside it: the heading comes first in document order.
    expect(markup.indexOf('Regions')).toBeLessThan(markup.indexOf('A region is an area'))
  })

  test('a heading with no description renders exactly the heading it always rendered', () => {
    expect(render({ heading: 'Products' })).toBe('<h1 class="font-semibold text-lg">Products</h1>')
  })

  test('an empty description is no description, so a table cannot gain a blank line', () => {
    expect(render({ heading: 'Products', description: '' })).toBe(render({ heading: 'Products' }))
  })

  test('renders nothing without a heading, as a table with no title always did', () => {
    expect(render({})).toBe('')
    expect(render({ description: 'Orphaned' })).toBe('')
  })
})
