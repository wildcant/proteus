import { customType } from 'drizzle-orm/pg-core'
import { BigNumber } from '../bignumber.js'

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
