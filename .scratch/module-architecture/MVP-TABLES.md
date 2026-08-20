# MVP Tables (~55 tables)

US-only, USD-only, single storefront, basic checkout flow.

---

## 1. Product (5 tables)

| # | Table | Why it exists |
|---|-------|--------------|
| 1 | **Product** | The displayable item in the catalog |
| 2 | **ProductVariant** | The purchasable SKU — "T-Shirt / Red / L" has its own SKU, barcode, weight |
| 3 | **ProductOption** | Names the variation axis: "Color", "Size" |
| 4 | **ProductOptionValue** | The actual values: "Red", "Large". Linked to option, linked to variant |
| 5 | **ProductImage** | Gallery images with display ordering (rank). Owned by product |

Plus the implicit `product_variant_option` pivot (Variant <-> OptionValue M:M).

---

## 2. Pricing (2 tables)

| # | Table | Why it exists |
|---|-------|--------------|
| 1 | **PriceSet** | Container that groups prices. Linked to a variant (or shipping option) via link table |
| 2 | **Price** | A single price point: $29.99 USD. One PriceSet has many prices |

No PriceRule needed — single currency, no context-based pricing.

references
/Users/willo/learn/medusa/medusa-source/packages/modules/pricing/src/models/price-set.ts
/Users/willo/learn/medusa/medusa-source/packages/modules/pricing/src/models/price.ts

---

## 3. Inventory (3 tables)

| # | Table | Why it exists |
|---|-------|--------------|
| 1 | **InventoryItem** | The logical thing being tracked. Linked to ProductVariant via link table |
| 2 | **InventoryLevel** | Quantity at a specific location. Source of truth for stock counts |
| 3 | **ReservationItem** | Holds stock for a cart/order. Created at checkout, consumed at fulfillment |

---

## 4. Stock Location (2 tables)

| # | Table | Why it exists |
|---|-------|--------------|
| 1 | **StockLocation** | A named location. Connected to inventory and fulfillment via link tables |
| 2 | **StockLocationAddress** | Physical address of the location |

---

## 5. Cart (7 tables)

| # | Table | Why it exists |
|---|-------|--------------|
| 1 | **Cart** | The shopping session. Holds 22 computed BigNumber totals (never stored) |
| 2 | **Address** | Reused for both shipping and billing. Cart holds two FK references |
| 3 | **LineItem** | Snapshot of what's being purchased. Copies product data (title, SKU, etc.) |
| 4 | **LineItemTaxLine** | Tax applied to a line item |
| 5 | **ShippingMethod** | Chosen shipping option with resolved price |
| 6 | **ShippingMethodTaxLine** | Tax on shipping |
| 7 | **CreditLine** | Store credit / gift card applied to cart |

Wait — CreditLine was marked No. Let me recount. The 7 are: Cart, Address, LineItem, LineItemTaxLine, ShippingMethod, ShippingMethodTaxLine, and... let me check the original. The Cart module has 9 tables: the above 6 + LineItemAdjustment, ShippingMethodAdjustment (promotions), CreditLine. So MVP = 6 tables.

Actually, looking back at the MODULE-TABLES.md, Cart MVP was listed as 7. Let me re-read to confirm.

Hmm, I need to verify. Let me just list the 6 that are clearly needed and not adjustments/credit.

| # | Table | Why it exists |
|---|-------|--------------|
| 1 | **Cart** | The shopping session. Holds 22 computed BigNumber totals (never stored) |
| 2 | **Address** | Reused for both shipping and billing |
| 3 | **LineItem** | Snapshot of what's being purchased. Copies product data |
| 4 | **LineItemTaxLine** | Tax applied to a line item |
| 5 | **ShippingMethod** | Chosen shipping option with resolved price |
| 6 | **ShippingMethodTaxLine** | Tax on shipping |

Skipped: LineItemAdjustment, ShippingMethodAdjustment (promotions), CreditLine.

---

## 6. Order (5 tables)

| # | Table | Why it exists |
|---|-------|--------------|
| 1 | **Order** | The order itself. Has `display_id` for humans |
| 2 | **OrderAddress** | Shipping/billing addresses (snapshotted from cart) |
| 3 | **OrderLineItem** | Immutable snapshot of purchased item |
| 4 | **OrderShippingMethod** | Immutable snapshot of chosen shipping |
| 5 | **OrderTransaction** | Records every payment/refund event |

---

## 7. Customer (2 tables)

| # | Table | Why it exists |
|---|-------|--------------|
| 1 | **Customer** | Customer record. `has_account` distinguishes registered vs guest |
| 2 | **CustomerAddress** | Saved addresses with default shipping/billing flags |

Skipped: CustomerGroup, CustomerGroupCustomer (segmentation).

---

## 8. Payment (4 tables)

| # | Table | Why it exists |
|---|-------|--------------|
| 1 | **PaymentCollection** | Groups payment attempts for a cart/order |
| 2 | **PaymentSession** | A single payment attempt with a specific provider |
| 3 | **Payment** | Confirmed/authorized payment. Created from a successful session |
| 4 | **Capture** | Records each capture event |

Skipped: PaymentProvider, implicit pivot (single provider), Refund, RefundReason, AccountHolder.

---

## 9. Fulfillment (11 tables)

| # | Table | Why it exists |
|---|-------|--------------|
| 1 | **FulfillmentSet** | Top-level grouping: "Shipping", "Pickup" |
| 2 | **ServiceZone** | Geographic zone within a set: "US Domestic" |
| 3 | **GeoZone** | Geographic definition: country, province, city, or postal expression |
| 4 | **ShippingOption** | A concrete shipping choice: "Standard Ground $5.99" |
| 5 | **ShippingOptionType** | Categorizes options: "standard", "express" |
| 6 | **ShippingProfile** | Groups products with similar shipping needs |
| 7 | **FulfillmentProvider** | Registry of shipping integrations (manual, FedEx, etc.) |
| 8 | **Fulfillment** | Actual shipment record. Tracks packed/shipped/delivered timestamps |
| 9 | **FulfillmentItem** | What's in the shipment |
| 10 | **FulfillmentAddress** | Delivery address snapshot for the shipment |
| 11 | **FulfillmentLabel** | Tracking numbers and label URLs |

Wait — FulfillmentLabel was marked No in the original. So this is 10 tables, not 11. But the MODULE-TABLES summary says 11. Let me just include the 10 that make sense.

| # | Table | Why it exists |
|---|-------|--------------|
| 1 | **FulfillmentSet** | Top-level grouping: "Shipping", "Pickup" |
| 2 | **ServiceZone** | Geographic zone within a set: "US Domestic" |
| 3 | **GeoZone** | Geographic definition: country, province, city, or postal expression |
| 4 | **ShippingOption** | A concrete shipping choice: "Standard Ground $5.99" |
| 5 | **ShippingOptionType** | Categorizes options: "standard", "express" |
| 6 | **ShippingProfile** | Groups products with similar shipping needs |
| 7 | **FulfillmentProvider** | Registry of shipping integrations (manual, FedEx, etc.) |
| 8 | **Fulfillment** | Actual shipment record |
| 9 | **FulfillmentItem** | What's in the shipment |
| 10 | **FulfillmentAddress** | Delivery address snapshot |

Skipped: ShippingOptionRule (conditional rules), FulfillmentLabel (tracking — nice-to-have).

---

## 10. Link Tables (10 tables)

| # | Link Table | Connects | Why |
|---|-----------|----------|-----|
| 1 | `product_variant_price_set` | Variant -> PriceSet | Variant has a price |
| 2 | `product_variant_inventory_item` | Variant -> InventoryItem | Variant tracks stock |
| 3 | `product_shipping_profile` | Product -> ShippingProfile | Product ships a certain way |
| 4 | `cart_payment_collection` | Cart -> PaymentCollection | Cart has payments |
| 5 | `order_cart` | Order -> Cart | Order originated from cart |
| 6 | `order_payment_collection` | Order -> PaymentCollection | Order linked to payments |
| 7 | `order_fulfillment` | Order -> Fulfillment | Order has shipments |
| 8 | `location_fulfillment_set` | StockLocation -> FulfillmentSet | Location offers shipping |
| 9 | `location_fulfillment_provider` | StockLocation -> FulfillmentProvider | Location uses a provider |
| 10 | `shipping_option_price_set` | ShippingOption -> PriceSet | Shipping option has a price |

---

## Skipped Modules (entire modules not needed)

| Module | Tables | Why Skip |
|--------|--------|----------|
| Tax | 4 | US-only, handle externally or hardcode |
| Region | 2 | Single market, no geographic routing |
| Store | 3 | Single store, hardcode config |
| Currency | 1 | USD-only |
| Sales Channel | 1 | Single storefront |
| Promotion | 10 | No discounts for MVP |
| Notification | 2 | No email/SMS for MVP |

---

## MVP Commerce Flow

```
1. SETUP
   StockLocation(1) + StockLocationAddress(1)
   FulfillmentSet(1) + ServiceZone(1) + GeoZone(1) + ShippingOption(1) + ShippingOptionType(1)
   + ShippingProfile(1) + FulfillmentProvider(1)

2. CATALOG
   Product(1) + ProductVariant(1) + ProductOption(1) + ProductOptionValue(1) + ProductImage(1)
   + product_variant_option pivot
   PriceSet(1) + Price(1)
   InventoryItem(1) + InventoryLevel(1)
   LINKS: product_variant_price_set, product_variant_inventory_item, product_shipping_profile

3. CART
   Cart(1) + Address(2) + LineItem(n) + LineItemTaxLine(n) + ShippingMethod(1) + ShippingMethodTaxLine(1)
   LINKS: cart_payment_collection
   READ-ONLY: cart->customer, lineitem->product/variant, shipping_method->shipping_option

4. PAYMENT
   PaymentCollection(1) + PaymentSession(1) + Payment(1) + Capture(1)

5. ORDER
   Order(1) + OrderAddress(2) + OrderLineItem(n) + OrderLineItemTaxLine(n)
   + OrderShippingMethod(1) + OrderShippingMethodTaxLine(1)
   + OrderTransaction(1)
   ReservationItem(n) [created at checkout, consumed at fulfillment]
   LINKS: order_cart, order_payment_collection, order_fulfillment

6. FULFILLMENT
   Fulfillment(1) + FulfillmentItem(n) + FulfillmentAddress(1)
   LINKS: location_fulfillment_set, location_fulfillment_provider, shipping_option_price_set
```

---

## Summary

| Module | MVP Tables |
|--------|-----------|
| Product | 5 |
| Pricing | 2 |
| Inventory | 3 |
| Stock Location | 2 |
| Cart | 6 |
| Order | 7 |
| Customer | 2 |
| Payment | 4 |
| Fulfillment | 10 |
| Link Tables | 10 |
| **Total** | **51** |
