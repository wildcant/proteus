import BigNumber from 'bignumber.js'
import { customType } from 'drizzle-orm/pg-core'

export { BigNumber }

// BigNumber precision note: bignumber.js has arbitrary precision but Postgres `numeric`
// can handle up to 131072 digits before the decimal and 16383 after. For values with 16+
// significant digits, floating-point coercion in JS (e.g., when logging or debugging) may
// lose precision — always use .toFixed() for serialization, never Number() conversion.

export const bignum = customType<{ data: BigNumber; driverData: string }>({
  dataType() {
    return 'numeric'
  },
  toDriver(value: BigNumber): string {
    return value.toFixed()
  },
  fromDriver(value: string): BigNumber {
    return new BigNumber(value)
  },
})
