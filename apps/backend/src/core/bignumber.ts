import BigNumber from 'bignumber.js'

// Kept apart from `db/bignum.ts` on purpose: that module defines a Drizzle `customType` and so
// drags `drizzle-orm/pg-core` into everything that loads it, including the Temporal workflow
// sandbox bundle. `BigNumber` is a domain value type — DTOs, workflows and the payload converter
// need the class and nothing else, so the class lives where it costs them nothing.

// BigNumber precision note: bignumber.js has arbitrary precision but Postgres `numeric`
// can handle up to 131072 digits before the decimal and 16383 after. For values with 16+
// significant digits, floating-point coercion in JS (e.g., when logging or debugging) may
// lose precision — always use .toFixed() for serialization, never Number() conversion.

export { BigNumber }
