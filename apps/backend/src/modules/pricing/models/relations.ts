import { relations } from 'drizzle-orm'
import { priceTable } from './price.js'
import { priceSetTable } from './price-set.js'

export const priceSetRelations = relations(priceSetTable, ({ many }) => ({
  prices: many(priceTable),
}))

export const priceRelations = relations(priceTable, ({ one }) => ({
  priceSet: one(priceSetTable, {
    fields: [priceTable.priceSetId],
    references: [priceSetTable.id],
  }),
}))
