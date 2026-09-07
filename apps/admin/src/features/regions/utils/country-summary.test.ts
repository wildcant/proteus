import { describe, expect, test } from 'vitest'
import { summariseCountries } from './country-summary'

describe('summariseCountries', () => {
  test('names the first two and counts the rest', () => {
    expect(summariseCountries(['Denmark', 'France', 'Germany', 'Italy', 'Spain', 'Sweden', 'Norway'])).toBe(
      'Denmark, France + 5 more',
    )
  })

  test('counts the third country rather than naming it, so the cell never grows', () => {
    expect(summariseCountries(['Denmark', 'France', 'Germany'])).toBe('Denmark, France + 1 more')
  })

  test('writes both out when there are exactly two', () => {
    expect(summariseCountries(['Denmark', 'France'])).toBe('Denmark, France')
  })

  test('writes one out on its own, with no trailing count', () => {
    expect(summariseCountries(['Denmark'])).toBe('Denmark')
  })

  test('says nothing rather than nothing at all when the region sells nowhere', () => {
    // A region with no countries is a region that sells to nobody — a state worth seeing, so the
    // cell carries a dash instead of going blank.
    expect(summariseCountries([])).toBe('—')
  })
})
