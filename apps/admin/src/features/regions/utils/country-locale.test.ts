import { describe, expect, it } from 'vitest'
import type { AdminCountry } from '#/api/generated/model'
import { assignmentIsComplete, reconcileAssignments, selectableCountries, suggestLocaleCode } from './country-locale'

const country = (id: string, regionId: string | null = null): AdminCountry => ({
  id,
  displayName: id.toUpperCase(),
  regionId,
  localeCode: regionId ? 'en-US' : null,
})

describe('selectableCountries', () => {
  it('offers only the countries no region has claimed', () => {
    const offered = selectableCountries([country('jp'), country('fr', 'reg_europe'), country('nz')])

    expect(offered.map((c) => c.id)).toEqual(['jp', 'nz'])
  })

  it('excludes the countries already in the region being edited, which the table below already lists', () => {
    const offered = selectableCountries([country('co', 'reg_colombia'), country('jp')])

    expect(offered.map((c) => c.id)).toEqual(['jp'])
  })

  it('offers nothing when every country is spoken for', () => {
    expect(selectableCountries([country('co', 'reg_colombia')])).toEqual([])
  })
})

describe('suggestLocaleCode', () => {
  it("suggests the country's most likely locale rather than deriving one from the code", () => {
    // `en-CO` would format a Colombian peso as `COP 1,234`; `es-CO` gives `$ 1.234`.
    expect(suggestLocaleCode('co')).toBe('es-CO')
    expect(suggestLocaleCode('dk')).toBe('da-DK')
    expect(suggestLocaleCode('jp')).toBe('ja-JP')
  })

  it('takes the code in either case and answers with the region uppercased', () => {
    expect(suggestLocaleCode('US')).toBe('en-US')
  })

  it('suggests nothing for a code no locale belongs to, rather than a locale for somewhere else', () => {
    // `und-ZZ` maximizes to `en-Latn-US` — a locale with nothing to do with the code asked about.
    expect(suggestLocaleCode('zz')).toBeNull()
    expect(suggestLocaleCode('!!')).toBeNull()
  })
})

describe('assignmentIsComplete', () => {
  it('is complete when every selected country carries a locale', () => {
    expect(assignmentIsComplete([{ id: 'co', localeCode: 'es-CO' }])).toBe(true)
  })

  it('refuses a country whose locale is missing or only whitespace', () => {
    expect(assignmentIsComplete([{ id: 'co', localeCode: '' }])).toBe(false)
    expect(assignmentIsComplete([{ id: 'co', localeCode: '   ' }])).toBe(false)
    expect(
      assignmentIsComplete([
        { id: 'co', localeCode: 'es-CO' },
        { id: 'jp', localeCode: '' },
      ]),
    ).toBe(false)
  })

  it('refuses an empty selection — there is nothing to assign', () => {
    expect(assignmentIsComplete([])).toBe(false)
  })
})

describe('reconcileAssignments', () => {
  it('starts a newly selected country off with its suggested locale', () => {
    expect(reconcileAssignments([], ['co'])).toEqual([{ id: 'co', localeCode: 'es-CO' }])
  })

  it('leaves a locale the merchant typed alone when the selection changes around it', () => {
    const current = [{ id: 'co', localeCode: 'en-CO' }]

    expect(reconcileAssignments(current, ['co', 'jp'])).toEqual([
      { id: 'co', localeCode: 'en-CO' },
      { id: 'jp', localeCode: 'ja-JP' },
    ])
  })

  it('drops a country the merchant deselected', () => {
    const current = [
      { id: 'co', localeCode: 'es-CO' },
      { id: 'jp', localeCode: 'ja-JP' },
    ]

    expect(reconcileAssignments(current, ['jp'])).toEqual([{ id: 'jp', localeCode: 'ja-JP' }])
  })

  it('leaves the locale empty when nothing can be suggested, so the form asks for one', () => {
    expect(reconcileAssignments([], ['zz'])).toEqual([{ id: 'zz', localeCode: '' }])
  })
})
