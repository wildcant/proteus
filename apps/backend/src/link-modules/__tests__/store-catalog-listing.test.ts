import { BigNumber } from '@core/bignumber.js'
import { test } from '@tests/setup/test-extend.js'
import { StoreCatalogListingRepository } from '../repositories/store-catalog-listing.js'

/**
 * Colour families are read by the listing in SQL, ahead of the structure file that names them: the
 * routes pass none yet, so this drives the repository itself.
 */
test.describe('Colour families', () => {
  test('a colourway is in every family one of its words names, the list narrows by any chosen family, and each family counts the rest', async ({
    expect,
    createTestContainer,
    getDb,
    service,
  }) => {
    const container = await createTestContainer()
    const listing = new StoreCatalogListingRepository({ getDb })
    const color = await service.create.productOption(container, {
      title: 'Color',
      values: ['Black / Red', 'All White', 'Burgundy', 'Navy', 'Redwood Brown'].map((value, rank) => ({ value, rank })),
    })

    /** A published product in one colourway, its one variant untracked and priced at `amount`. */
    const product = async (colourway: string, amount: number) => {
      const colourwayValue = color.values.find((candidate) => candidate.value === colourway)
      if (!colourwayValue) throw new Error(`No colourway ${colourway}`)
      const { product } = await service.create.product(container, { status: 'published' })
      await service.update.productOptions(container, product.id, {
        options: [{ optionId: color.id, valueIds: [colourwayValue.id] }],
      })
      const variants = await service.create.productVariants(container, product.id, [
        { manageInventory: false, optionValues: { [color.id]: colourwayValue.id } },
      ])
      await service.create.variantPrices(
        container,
        variants.map((variant) => variant.id),
        { prices: [{ currencyCode: 'usd', amount: new BigNumber(amount) }] },
      )
      return product
    }
    const blackRed = await product('Black / Red', 100)
    const white = await product('All White', 200)
    const burgundy = await product('Burgundy', 300)
    const navy = await product('Navy', 400)
    // "Red" inside a word is not the word: Redwood is no red.
    const redwood = await product('Redwood Brown', 500)

    const families = { Red: ['red', 'burgundy'], White: ['white'], Black: ['black'], Blue: ['navy', 'blue'], Green: [] }
    const colorFamilies = (selected: string[]) => ({ optionTitle: 'Color', families, selected })
    const listed = async (selected: string[], priceRange?: { minPrice?: number; maxPrice?: number }) => {
      const { rows, count } = await listing.listStoreProducts({
        currencyCode: 'usd',
        products: {},
        priceRange,
        colorFamilies: colorFamilies(selected),
        sort: 'priceAsc',
        limit: 10,
        offset: 0,
      })
      return { ids: rows.map((row) => row.productId), count }
    }
    const counts = async (selected: string[], priceRange?: { minPrice?: number; maxPrice?: number }) => {
      const facets = await listing.listStoreFacets({
        currencyCode: 'usd',
        products: {},
        selections: {},
        priceRange,
        colorFamilies: colorFamilies(selected),
      })
      return Object.fromEntries(facets.colorFamilyCounts.map(({ family, count }) => [family, count]))
    }

    // One family keeps each colourway holding one of its words, whole and ignoring case.
    expect(await listed(['Red'])).toEqual({ ids: [blackRed.id, burgundy.id], count: 2 })
    // A two-colour colourway is in both of its families.
    expect(await listed(['Black'])).toEqual({ ids: [blackRed.id], count: 1 })
    // Families widen each other (OR), and a price range still narrows them.
    expect(await listed(['Red', 'White'])).toEqual({ ids: [blackRed.id, white.id, burgundy.id], count: 3 })
    expect(await listed(['Red', 'White'], { minPrice: 150 })).toEqual({ ids: [white.id, burgundy.id], count: 2 })
    // No family chosen narrows nothing; a family with no words matches nothing.
    expect(await listed([])).toEqual({
      ids: [blackRed.id, white.id, burgundy.id, navy.id, redwood.id],
      count: 5,
    })
    expect(await listed(['Green'])).toEqual({ ids: [], count: 0 })

    // Each family counts the products choosing it would add, in the families' order — its own
    // selection never narrows it, the price range does.
    const everyFamily = { Red: 2, White: 1, Black: 1, Blue: 1, Green: 0 }
    expect(await counts([])).toEqual(everyFamily)
    expect(await counts(['Red'])).toEqual(everyFamily)
    expect(await counts([], { maxPrice: 250 })).toEqual({ Red: 1, White: 1, Black: 1, Blue: 0, Green: 0 })
  })
})
