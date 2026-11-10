import { defaultParseSearch } from '@tanstack/react-router'
import { describe, expect, test } from 'vitest'
import { stringifySearch } from '#/lib/search-params'
import { productListSearchSchema } from './product-list-search'

/**
 * The Tag filter's URL, through the router's own parser and the router's own writer: what a chip
 * writes, and what the list reads back from a link someone typed or shared.
 *
 * In the browser project although nothing renders: the schema reads its sort names from the query
 * layer, whose Lingui macros and backend address only that project provides.
 */
const readSearch = (query: string) => productListSearchSchema.parse(defaultParseSearch(query))

describe('the product list URL', () => {
  test('writes chosen Tags as a repeated key and leaves the other params as the default writes them', () => {
    expect(stringifySearch({ q: 'organic tee', tag: ['cotton', 'wool'], offset: 12 })).toBe(
      '?q=organic+tee&offset=12&tag=cotton&tag=wool',
    )
    expect(stringifySearch({ tag: undefined, sort: undefined })).toBe('')
  })

  test('reads back exactly what it wrote', () => {
    const search = { q: 'tee', tag: ['cotton', '2024'], sort: 'az' as const, offset: 24 }
    expect(readSearch(stringifySearch(search))).toEqual(search)
  })

  test('reads a hand-typed single Tag as a one-value filter', () => {
    expect(readSearch('?tag=cotton').tag).toEqual(['cotton'])
    expect(readSearch('?tag=2024').tag).toEqual(['2024'])
    expect(readSearch('?tag=').tag).toBeUndefined()
    expect(readSearch('?q=tee').tag).toBeUndefined()
  })
})
