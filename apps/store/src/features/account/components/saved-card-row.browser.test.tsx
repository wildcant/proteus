import { RadioGroup } from '@proteus/ui'
import { expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { StoreSavedMethod } from '#/api/generated/model'
import { SavedCardRow } from './saved-card-row'

/**
 * The card row, mounted with props and nothing else.
 *
 * Everything here is render and interaction logic — what a row is labelled, what is disabled, what
 * a press does — so it belongs at the level where a wallet is a value rather than a round trip.
 * It was previously asserted through Playwright against a stubbed `GET /store/payment-methods`,
 * which meant a test could pass while the route, the module's ordering and the gateway's ownership
 * check were all absent. Those claims now live in the backend suite; these live here.
 *
 * A real Chromium rather than a DOM emulation, because two of these are about things jsdom does
 * not have opinions about: whether a control is genuinely disabled, and whether a button nested in
 * a label steals the label's click.
 */

/** A removal that succeeds and does nothing, for the rows whose removal is not the subject. */
const noop = async () => undefined

/** A card, expiring far enough out that the suite's own clock never makes it stale. */
function card(over: Partial<StoreSavedMethod> = {}): StoreSavedMethod {
  const now = new Date()
  return {
    id: 'pm_test_row',
    brand: 'visa',
    last4: '4242',
    expMonth: now.getMonth() + 1,
    expYear: now.getFullYear() + 3,
    isDefault: false,
    ...over,
  }
}

/** The month that has just passed — expired whichever month the suite runs in. */
function lastMonth(): { expMonth: number; expYear: number } {
  const previous = new Date()
  previous.setDate(1)
  previous.setMonth(previous.getMonth() - 1)
  return { expMonth: previous.getMonth() + 1, expYear: previous.getFullYear() }
}

/** This month — the card still works until the last day of it. */
function thisMonth(): { expMonth: number; expYear: number } {
  const now = new Date()
  return { expMonth: now.getMonth() + 1, expYear: now.getFullYear() }
}

/**
 * A row in the group it always lives in. `RadioGroupItem` reads its checked state from the group,
 * so a row rendered bare would answer for a control that does not exist.
 */
function renderRow(method: StoreSavedMethod, onRemove: () => Promise<void> = noop) {
  return render(
    <RadioGroup defaultValue={method.isDefault ? method.id : undefined}>
      <SavedCardRow
        method={method}
        checked={!!method.isDefault}
        chooseLabel={`Pay with ${method.last4}`}
        onRemove={onRemove}
      />
    </RadioGroup>,
  )
}

test('an expired card is labelled and cannot be chosen', async () => {
  renderRow(card({ ...lastMonth(), isDefault: true }))

  // Shown rather than hidden: a shopper looking for a card they own should find it and be told why
  // it is unusable, not left wondering whether the store lost it.
  await expect.element(page.getByText('Expired')).toBeVisible()
  await expect.element(page.getByRole('radio', { name: 'Pay with 4242' })).toBeDisabled()
})

test('a card expiring this month is labelled but still selectable', async () => {
  renderRow(card(thisMonth()))

  // A warning, not a refusal: the card works until the last day of the month, and refusing it
  // would turn the notice into a wrongly declined checkout.
  await expect.element(page.getByText('Expires this month')).toBeVisible()
  await expect.element(page.getByRole('radio', { name: 'Pay with 4242' })).toBeEnabled()
})

test('removing takes two presses, and the first can be taken back', async () => {
  const onRemove = vi.fn(noop)
  renderRow(card(), onRemove)

  await page.getByRole('button', { name: 'Remove Visa ending in 4242' }).click()
  await expect.element(page.getByText('Remove Visa ending in 4242?')).toBeVisible()

  await page.getByRole('button', { name: 'Keep' }).click()
  await expect.element(page.getByRole('radio', { name: 'Pay with 4242' })).toBeVisible()
  expect(onRemove).not.toHaveBeenCalled()

  await page.getByRole('button', { name: 'Remove Visa ending in 4242' }).click()
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  expect(onRemove).toHaveBeenCalledOnce()
})

test('the Remove control is not nested inside the selectable label', async () => {
  renderRow(card())

  // A button inside a label fires the label's control on every click, so this press would select
  // the card on its way to deleting it. Asserted structurally because the behaviour it produces is
  // indistinguishable from a deliberate selection.
  const remove = page.getByRole('button', { name: 'Remove Visa ending in 4242' })
  await expect.element(remove).toBeVisible()
  expect(remove.element().closest('label')).toBeNull()
})

test('a removal that fails puts the row back and says so', async () => {
  renderRow(card(), async () => {
    throw new Error('the gateway refused')
  })

  await page.getByRole('button', { name: 'Remove Visa ending in 4242' }).click()
  await page.getByRole('button', { name: 'Remove', exact: true }).click()

  // The row survives because the card did. A removal that failed at the gateway must not look like
  // one that worked.
  await expect.element(page.getByText("Couldn't remove that card.")).toBeVisible()
  await expect.element(page.getByRole('radio', { name: 'Pay with 4242' })).toBeVisible()
})
