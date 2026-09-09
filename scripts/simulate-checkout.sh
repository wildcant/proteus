#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
DIM='\033[2m'
NC='\033[0m'

step=0
step() {
  step=$((step + 1))
  echo ""
  echo -e "${GREEN}━━━ Step ${step}: $1 ━━━${NC}"
}

request() {
  local method=$1 path=$2 body=${3:-}
  echo -e "${DIM}${method} ${path}${NC}"
  if [ -n "$body" ]; then
    echo -e "${DIM}Body: ${body}${NC}"
  fi
}

response() {
  echo -e "${CYAN}$1${NC}"
}

# curl wrapper: shows response body on HTTP error instead of dying silently
api() {
  local tmpfile
  tmpfile=$(mktemp)
  local http_code
  http_code=$(curl -s -o "$tmpfile" -w '%{http_code}' "$@") || {
    echo -e "${RED}Connection failed (is the server running?)${NC}" >&2
    rm -f "$tmpfile"
    exit 1
  }
  if [[ "$http_code" -ge 400 ]]; then
    echo -e "${RED}HTTP ${http_code}:${NC}" >&2
    (jq . "$tmpfile" 2>/dev/null || cat "$tmpfile") >&2
    rm -f "$tmpfile"
    exit 1
  fi
  cat "$tmpfile"
  rm -f "$tmpfile"
}

# Ensure jq is available
if ! command -v jq &>/dev/null; then
  echo "Error: jq is required. Install it with: brew install jq"
  exit 1
fi

echo -e "${YELLOW}╔══════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║     Checkout Flow Simulation             ║${NC}"
echo -e "${YELLOW}║     ${DIM}${BASE_URL}${YELLOW}              ║${NC}"
echo -e "${YELLOW}╚══════════════════════════════════════════╝${NC}"

# ══════════════════════════════════════════
# Auth — login seeded users (created by db:seed:dev)
# ══════════════════════════════════════════

ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="password"

# ──────────────────────────────────────────
step "Login admin user (seeded by db:seed:dev)"
LOGIN_BODY=$(jq -n --arg email "$ADMIN_EMAIL" --arg password "$ADMIN_PASSWORD" '{email: $email, password: $password}')
request POST /auth/user/emailpass "$LOGIN_BODY"

LOGIN_RESPONSE=$(api -X POST "${BASE_URL}/auth/user/emailpass" \
  -H "Content-Type: application/json" \
  -d "$LOGIN_BODY")
ADMIN_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
response "Got JWT (${#ADMIN_TOKEN} chars)"

AUTH_HEADER="Authorization: Bearer ${ADMIN_TOKEN}"

# ──────────────────────────────────────────
step "Login store customer (seeded by db:seed:dev)"
CUSTOMER_EMAIL="customer@example.com"
CUSTOMER_PASSWORD="password"
CUST_LOGIN_BODY=$(jq -n --arg email "$CUSTOMER_EMAIL" --arg password "$CUSTOMER_PASSWORD" '{email: $email, password: $password}')
request POST /auth/customer/emailpass "$CUST_LOGIN_BODY"

CUST_LOGIN_RESPONSE=$(api -X POST "${BASE_URL}/auth/customer/emailpass" \
  -H "Content-Type: application/json" \
  -d "$CUST_LOGIN_BODY")
STORE_TOKEN=$(echo "$CUST_LOGIN_RESPONSE" | jq -r '.token')
response "Got customer JWT (${#STORE_TOKEN} chars)"

STORE_AUTH_HEADER="Authorization: Bearer ${STORE_TOKEN}"

# ──────────────────────────────────────────
step "Browse products"
request GET /store/products

PRODUCTS=$(api -H "$STORE_AUTH_HEADER" "${BASE_URL}/store/products")
PRODUCT_ID=$(echo "$PRODUCTS" | jq -r '.products[0].id')
PRODUCT_TITLE=$(echo "$PRODUCTS" | jq -r '.products[0].title')
PRODUCT_COUNT=$(echo "$PRODUCTS" | jq '.products | length')
response "Found ${PRODUCT_COUNT} products. Picking: ${PRODUCT_TITLE} (${PRODUCT_ID})"

# ──────────────────────────────────────────
step "View product details + variants"
request GET "/store/products/${PRODUCT_ID}"

PRODUCT=$(api -H "$STORE_AUTH_HEADER" "${BASE_URL}/store/products/${PRODUCT_ID}")
VARIANT_ID=$(echo "$PRODUCT" | jq -r '.product.variants[0].id')
VARIANT_SKU=$(echo "$PRODUCT" | jq -r '.product.variants[0].sku')
VARIANT_TITLE=$(echo "$PRODUCT" | jq -r '.product.variants[0].title')
VARIANT_COUNT=$(echo "$PRODUCT" | jq '.product.variants | length')
response "Product has ${VARIANT_COUNT} variants. Picking: ${VARIANT_TITLE} / ${VARIANT_SKU} (${VARIANT_ID})"

# ──────────────────────────────────────────
step "Create cart"
CART_BODY='{"currencyCode":"usd"}'
request POST /store/carts "$CART_BODY"

CART_RESPONSE=$(api -X POST "${BASE_URL}/store/carts" \
  -H "Content-Type: application/json" \
  -H "$STORE_AUTH_HEADER" \
  -d "$CART_BODY")
CART_ID=$(echo "$CART_RESPONSE" | jq -r '.cart.id')
response "Created cart: ${CART_ID}"

# ──────────────────────────────────────────
step "Add line item to cart"
ADD_ITEM_BODY=$(jq -n \
  --arg title "${PRODUCT_TITLE} (${VARIANT_TITLE})" \
  --arg variantId "$VARIANT_ID" \
  --arg productId "$PRODUCT_ID" \
  --arg productTitle "$PRODUCT_TITLE" \
  --arg variantSku "$VARIANT_SKU" \
  '{title: $title, quantity: 2, unitPrice: 2500, variantId: $variantId, productId: $productId, productTitle: $productTitle, variantSku: $variantSku}')
request POST "/store/carts/${CART_ID}/line-items" "$ADD_ITEM_BODY"

LINE_ITEM_RESPONSE=$(api -X POST "${BASE_URL}/store/carts/${CART_ID}/line-items" \
  -H "Content-Type: application/json" \
  -H "$STORE_AUTH_HEADER" \
  -d "$ADD_ITEM_BODY")
LINE_ITEM_ID=$(echo "$LINE_ITEM_RESPONSE" | jq -r '.lineItem.id')
response "Added line item: ${LINE_ITEM_ID} (2x @ \$25.00)"

# ──────────────────────────────────────────
step "View cart"
request GET "/store/carts/${CART_ID}"

CART=$(api -H "$STORE_AUTH_HEADER" "${BASE_URL}/store/carts/${CART_ID}")
ITEM_COUNT=$(echo "$CART" | jq '.cart.items | length')
response "Cart has ${ITEM_COUNT} item(s):"
echo "$CART" | jq -r '.cart.items[] | "  - \(.title) x\(.quantity) @ $\(.unitPrice / 100)"'

# ──────────────────────────────────────────
step "Update line item quantity (2 → 3)"
UPDATE_BODY='{"quantity":3}'
request POST "/store/carts/${CART_ID}/line-items/${LINE_ITEM_ID}" "$UPDATE_BODY"

UPDATED_ITEM=$(api -X POST "${BASE_URL}/store/carts/${CART_ID}/line-items/${LINE_ITEM_ID}" \
  -H "Content-Type: application/json" \
  -H "$STORE_AUTH_HEADER" \
  -d "$UPDATE_BODY")
NEW_QTY=$(echo "$UPDATED_ITEM" | jq -r '.lineItem.quantity')
response "Updated quantity to ${NEW_QTY}"

# ──────────────────────────────────────────
step "Update cart (set email)"
UPDATE_CART_BODY='{"email":"customer@example.com"}'
request POST "/store/carts/${CART_ID}" "$UPDATE_CART_BODY"

UPDATED_CART=$(api -X POST "${BASE_URL}/store/carts/${CART_ID}" \
  -H "Content-Type: application/json" \
  -H "$STORE_AUTH_HEADER" \
  -d "$UPDATE_CART_BODY")
EMAIL=$(echo "$UPDATED_CART" | jq -r '.cart.email')
response "Set email to: ${EMAIL}"

# ══════════════════════════════════════════
# Shipping setup (admin) + selection (store)
# ══════════════════════════════════════════

# ──────────────────────────────────────────
step "Create shipping profile (admin)"
SP_BODY='{"name":"Default","type":"default"}'
request POST /admin/shipping-profiles "$SP_BODY"

SP_RESPONSE=$(api -X POST "${BASE_URL}/admin/shipping-profiles" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d "$SP_BODY")
SHIPPING_PROFILE_ID=$(echo "$SP_RESPONSE" | jq -r '.shippingProfile.id')
response "Created shipping profile: ${SHIPPING_PROFILE_ID}"

# ──────────────────────────────────────────
step "Create fulfillment set + service zone + geo zone (admin)"
FUSET_BODY='{"name":"Default Shipping","type":"shipping"}'
request POST /admin/fulfillment-sets "$FUSET_BODY"

FUSET_RESPONSE=$(api -X POST "${BASE_URL}/admin/fulfillment-sets" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d "$FUSET_BODY")
FUSET_ID=$(echo "$FUSET_RESPONSE" | jq -r '.fulfillmentSet.id')
response "Created fulfillment set: ${FUSET_ID}"

SZ_BODY='{"name":"US Domestic","geoZones":[{"type":"country","countryCode":"US"}]}'
request POST "/admin/fulfillment-sets/${FUSET_ID}/service-zones" "$SZ_BODY"

SZ_RESPONSE=$(api -X POST "${BASE_URL}/admin/fulfillment-sets/${FUSET_ID}/service-zones" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d "$SZ_BODY")
SERVICE_ZONE_ID=$(echo "$SZ_RESPONSE" | jq -r '.serviceZone.id')
response "Created service zone: ${SERVICE_ZONE_ID} (with inline US geo zone)"

# ──────────────────────────────────────────
step "List fulfillment providers (admin)"
request GET /admin/fulfillment-providers

FP_RESPONSE=$(api -H "$AUTH_HEADER" "${BASE_URL}/admin/fulfillment-providers")
FP_COUNT=$(echo "$FP_RESPONSE" | jq '.fulfillmentProviders | length')
response "Available fulfillment providers: ${FP_COUNT}"
echo "$FP_RESPONSE" | jq -r '.fulfillmentProviders[] | "  - \(.id)"'
FP_ID=$(echo "$FP_RESPONSE" | jq -r '.fulfillmentProviders[0].id')

# ──────────────────────────────────────────
step "Create shipping option (admin)"
SO_BODY=$(jq -n \
  --arg szId "$SERVICE_ZONE_ID" \
  --arg spId "$SHIPPING_PROFILE_ID" \
  --arg fpId "$FP_ID" \
  '{name: "Standard Shipping", priceType: "flat", amount: 599, serviceZoneId: $szId, shippingProfileId: $spId, providerId: $fpId}')
request POST /admin/shipping-options "$SO_BODY"

SO_RESPONSE=$(api -X POST "${BASE_URL}/admin/shipping-options" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d "$SO_BODY")
SHIPPING_OPTION_ID=$(echo "$SO_RESPONSE" | jq -r '.shippingOption.id')
SO_AMOUNT=$(echo "$SO_RESPONSE" | jq -r '.shippingOption.amount')
response "Created shipping option: ${SHIPPING_OPTION_ID} (amount: \$$(echo "scale=2; ${SO_AMOUNT}/100" | bc))"

# ──────────────────────────────────────────
step "List available shipping options for cart (store)"
request GET "/store/carts/${CART_ID}/shipping-options?country_code=US"

AVAILABLE_OPTIONS=$(api -H "$STORE_AUTH_HEADER" "${BASE_URL}/store/carts/${CART_ID}/shipping-options?country_code=US")
OPTION_COUNT=$(echo "$AVAILABLE_OPTIONS" | jq '.shippingOptions | length')
response "Available shipping options: ${OPTION_COUNT}"
echo "$AVAILABLE_OPTIONS" | jq -r '.shippingOptions[] | "  - \(.name) @ $\(.amount / 100) (\(.id))"'

# ──────────────────────────────────────────
step "Select shipping method for cart (store)"
SM_BODY=$(jq -n --arg optionId "$SHIPPING_OPTION_ID" '{shippingOptionId: $optionId}')
request POST "/store/carts/${CART_ID}/shipping-methods" "$SM_BODY"

SM_RESPONSE=$(api -X POST "${BASE_URL}/store/carts/${CART_ID}/shipping-methods" \
  -H "Content-Type: application/json" \
  -H "$STORE_AUTH_HEADER" \
  -d "$SM_BODY")
SM_ID=$(echo "$SM_RESPONSE" | jq -r '.shippingMethod.id')
SM_NAME=$(echo "$SM_RESPONSE" | jq -r '.shippingMethod.name')
SM_AMOUNT=$(echo "$SM_RESPONSE" | jq -r '.shippingMethod.amount')
response "Selected shipping method: ${SM_NAME} - \$$(echo "scale=2; ${SM_AMOUNT}/100" | bc) (${SM_ID})"

# ──────────────────────────────────────────
step "View cart (with shipping)"
request GET "/store/carts/${CART_ID}"

CART=$(api -H "$STORE_AUTH_HEADER" "${BASE_URL}/store/carts/${CART_ID}")
ITEM_COUNT=$(echo "$CART" | jq '.cart.items | length')
SM_COUNT=$(echo "$CART" | jq '.cart.shippingMethods | length')
response "Cart has ${ITEM_COUNT} item(s) and ${SM_COUNT} shipping method(s):"
echo "$CART" | jq -r '.cart.items[] | "  - \(.title) x\(.quantity) @ $\(.unitPrice / 100)"'
echo "$CART" | jq -r '.cart.shippingMethods[] | "  - [shipping] \(.name) @ $\(.amount / 100)"'

# ══════════════════════════════════════════
# Payment + complete
# ══════════════════════════════════════════

# ──────────────────────────────────────────
step "Create payment collection for cart"
PAY_COL_BODY=$(jq -n --arg cartId "$CART_ID" '{cartId: $cartId}')
request POST /store/payment-collections "$PAY_COL_BODY"

PAY_COL_RESPONSE=$(api -X POST "${BASE_URL}/store/payment-collections" \
  -H "Content-Type: application/json" \
  -H "$STORE_AUTH_HEADER" \
  -d "$PAY_COL_BODY")
PAY_COL_ID=$(echo "$PAY_COL_RESPONSE" | jq -r '.paymentCollection.id')
PAY_COL_AMOUNT=$(echo "$PAY_COL_RESPONSE" | jq -r '.paymentCollection.amount')
response "Created payment collection: ${PAY_COL_ID} (amount: \$$(echo "scale=2; ${PAY_COL_AMOUNT}/100" | bc))"

# ──────────────────────────────────────────
step "List payment providers"
request GET "/store/carts/${CART_ID}/payment-providers"

PROVIDERS=$(api -H "$STORE_AUTH_HEADER" "${BASE_URL}/store/carts/${CART_ID}/payment-providers")
PROVIDER_COUNT=$(echo "$PROVIDERS" | jq '.paymentProviders | length')
response "Available providers: ${PROVIDER_COUNT}"
echo "$PROVIDERS" | jq -r '.paymentProviders[] | "  - \(.id)"'

# ──────────────────────────────────────────
step "Initialize payment session (system provider)"
SESSION_BODY='{"providerId":"pp_system_default"}'
request POST "/store/payment-collections/${PAY_COL_ID}/payment-sessions" "$SESSION_BODY"

SESSION_RESPONSE=$(api -X POST "${BASE_URL}/store/payment-collections/${PAY_COL_ID}/payment-sessions" \
  -H "Content-Type: application/json" \
  -H "$STORE_AUTH_HEADER" \
  -d "$SESSION_BODY")
SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.paymentSession.id')
SESSION_STATUS=$(echo "$SESSION_RESPONSE" | jq -r '.paymentSession.status')
response "Created payment session: ${SESSION_ID} (status: ${SESSION_STATUS})"

# ──────────────────────────────────────────
step "Complete cart (authorize + capture + complete)"
request POST "/store/carts/${CART_ID}/complete"

COMPLETE_RESPONSE=$(api -X POST "${BASE_URL}/store/carts/${CART_ID}/complete" \
  -H "Content-Type: application/json" \
  -H "$STORE_AUTH_HEADER")
CART_STATUS=$(echo "$COMPLETE_RESPONSE" | jq -r '.cart.status')
COMPLETED_AT=$(echo "$COMPLETE_RESPONSE" | jq -r '.cart.completedAt')
response "Cart completed! Status: ${CART_STATUS}, completedAt: ${COMPLETED_AT}"

# ──────────────────────────────────────────
step "Verify: get payment collection (admin)"
request GET "/admin/payment-collections/${PAY_COL_ID}"

FINAL_COL=$(api -H "$AUTH_HEADER" "${BASE_URL}/admin/payment-collections/${PAY_COL_ID}")
COL_STATUS=$(echo "$FINAL_COL" | jq -r '.paymentCollection.status')
CAPTURED=$(echo "$FINAL_COL" | jq -r '.paymentCollection.capturedAmount')
response "Payment collection status: ${COL_STATUS}, captured: \$$(echo "scale=2; ${CAPTURED}/100" | bc)"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Checkout complete!                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
