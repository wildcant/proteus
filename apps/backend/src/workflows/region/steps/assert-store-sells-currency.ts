import { ErrorTypes } from '@core/errors/app-error.js'
import type { IStoreModuleService } from '@core/types/store/service.js'
import { Modules } from '@core/utils/index.js'
import { type WorkflowContext, WorkflowTerminalError } from '@core/workflows/types.js'

/** A step in its own file still owns its failure contract; the workflow calling it spreads this. */
export const assertStoreSellsCurrencyThrows = [ErrorTypes.INVALID_DATA] as const

/**
 * Refuses a currency the store does not sell in.
 *
 * A region's currency is the money every price, cart and payment inside it settles in, and the
 * admin's price forms offer exactly the store's currencies — so a region denominated in anything
 * else is a region whose products can never be priced, and whose shoppers see nothing. The check
 * belongs here rather than in the schema because it needs the database.
 *
 * `undefined` passes: an update that does not mention the currency is not changing it.
 */
export async function assertStoreSellsCurrencyStep(ctx: WorkflowContext, currencyCode?: string): Promise<void> {
  await ctx.step('assert-store-sells-currency', async ({ container }) => {
    if (currencyCode === undefined) return

    const storeService = container.resolve<IStoreModuleService>(Modules.STORE)
    const store = await storeService.resolveStore()
    const currencies = store ? await storeService.listStoreCurrencies({ storeId: store.id }) : []

    if (currencies.some((currency) => currency.currencyCode === currencyCode)) return

    const sold = currencies.map((currency) => currency.currencyCode).join(', ')
    throw new WorkflowTerminalError({
      type: ErrorTypes.INVALID_DATA,
      message: sold
        ? `The store does not sell in "${currencyCode}". Its currencies are: ${sold}.`
        : `The store does not sell in "${currencyCode}". It has no currencies configured.`,
    })
  })
}
