import type { BigNumber } from '@core/bignumber.js'
import type { EnrichedOrderLineItemDTO, OrderAddressDTO, OrderDTO, OrderTotals } from '@core/types/order/common.js'
import { formatDate } from '@proteus/utils'

/** Flat, string-only payload. Resend's template API accepts scalar variables only
 *  (`Record<string, string | number>`), with no block helpers, so the line items arrive
 *  as a pre-rendered HTML fragment instead of an array the template could iterate. */
export type OrderConfirmationData = {
  displayId: string
  orderDate: string
  email: string
  orderLink: string
  itemRows: string
  itemsTotal: string
  shippingTotal: string
  orderTotal: string
  shippingAddress: string
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Product titles and addresses are user-supplied and land in the template through
 *  `{{{triple-brace}}}` variables, which Resend interpolates without escaping. A title
 *  like `Johnson & Johnson` would otherwise emit invalid markup, and one containing a
 *  `<` could break out of the row and wreck the layout. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character)
}

/** Display-only coercion. Order amounts sit far below the ~16 significant digits where
 *  BigNumber to number loses precision; persisted values always go through `.toFixed()`. */
function formatMoney(amount: BigNumber, currencyCode: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount.toNumber())
}

/** `Intl.DisplayNames` throws on codes that are not two letters, so anything unexpected
 *  falls back to the raw code rather than failing the whole email. */
function formatCountry(countryCode: string): string {
  if (countryCode.length !== 2) return countryCode.toUpperCase()
  return new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode.toUpperCase()) ?? countryCode.toUpperCase()
}

function buildItemRow(item: EnrichedOrderLineItemDTO, currencyCode: string): string {
  const thumbnail = item.thumbnail
    ? `<img src="${escapeHtml(item.thumbnail)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border-radius:6px;border:1px solid #e6e6e6;background-color:#f6f9fc" />`
    : '<div style="width:56px;height:56px;border-radius:6px;border:1px solid #e6e6e6;background-color:#f6f9fc"></div>'

  const variant = item.variantTitle
    ? `<p style="margin:2px 0 0;padding:0;font-size:13px;line-height:1.4;color:#8898aa">${escapeHtml(item.variantTitle)}</p>`
    : ''

  return [
    '<tr>',
    `<td width="68" valign="top" style="width:68px;padding:12px 12px 12px 0">${thumbnail}</td>`,
    '<td valign="top" style="padding:12px 12px 12px 0">',
    `<p style="margin:0;padding:0;font-size:15px;line-height:1.4;font-weight:500;color:#1a1a1a">${escapeHtml(item.title)}</p>`,
    variant,
    `<p style="margin:2px 0 0;padding:0;font-size:13px;line-height:1.4;color:#8898aa">Qty ${item.quantity} &times; ${formatMoney(item.unitPrice, currencyCode)}</p>`,
    '</td>',
    `<td width="90" align="right" valign="top" style="width:90px;padding:12px 0;white-space:nowrap">`,
    `<p style="margin:0;padding:0;font-size:15px;line-height:1.4;color:#1a1a1a">${formatMoney(item.lineTotal, currencyCode)}</p>`,
    '</td>',
    '</tr>',
  ].join('')
}

function buildShippingAddress(address: OrderAddressDTO | null): string {
  if (!address) return ''

  const name = [address.firstName, address.lastName].filter(Boolean).join(' ')
  const cityLine = [address.city, address.province, address.postalCode].filter(Boolean).join(', ')

  return [
    name,
    address.company,
    address.address1,
    address.address2,
    cityLine,
    address.countryCode ? formatCountry(address.countryCode) : null,
  ]
    .filter((line): line is string => Boolean(line))
    .map(escapeHtml)
    .join('<br />')
}

export function prepareOrderConfirmationData(data: {
  order: OrderDTO
  lineItems: EnrichedOrderLineItemDTO[]
  totals: OrderTotals
  shippingAddress: OrderAddressDTO | null
  storeUrl: string
}): OrderConfirmationData {
  const { order, lineItems, totals, shippingAddress, storeUrl } = data

  return {
    displayId: String(order.displayId),
    orderDate: formatDate(order.createdAt),
    email: escapeHtml(order.email ?? ''),
    orderLink: escapeHtml(`${storeUrl}/orders/${order.id}`),
    itemRows: lineItems.map((item) => buildItemRow(item, order.currencyCode)).join(''),
    itemsTotal: formatMoney(totals.itemsTotal, order.currencyCode),
    shippingTotal: formatMoney(totals.shippingTotal, order.currencyCode),
    orderTotal: formatMoney(totals.orderTotal, order.currencyCode),
    shippingAddress: buildShippingAddress(shippingAddress),
  }
}
