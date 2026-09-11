import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import { DrizzleQueryError } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { dbErrorMapper, restoreErrorMapper } from '../db-error-mapper.js'

/**
 * Since 0.44 Drizzle wraps every driver failure in a `DrizzleQueryError` and hangs the original on
 * `cause`. The mapper reads Postgres' `code` and `detail`, which the wrapper does not carry, so an
 * unwrapped one turns every constraint violation into a 500. These cases build the wrapper by hand
 * rather than through a query, so they hold whether or not the ORM keeps wrapping.
 */
type PgFields = { code: string; detail?: string; table?: string; column?: string }

/** The error the driver raises, carrying Postgres' wire-protocol field names. */
const pgError = ({ code, detail, table, column }: PgFields) =>
  Object.assign(new Error(`postgres ${code}`), {
    code,
    detail,
    column,
    // biome-ignore lint/style/useNamingConvention: Postgres wire protocol field name
    table_name: table,
  })

const wrapped = (fields: PgFields) => new DrizzleQueryError('insert into "customer" …', [], pgError(fields))

const thrownBy = (mapper: (err: unknown) => never, err: unknown) => {
  try {
    mapper(err)
  } catch (caught) {
    return caught
  }
  throw new Error('mapper did not throw')
}

describe('dbErrorMapper', () => {
  it('maps a unique violation the driver raised directly', () => {
    const error = thrownBy(dbErrorMapper, pgError({ code: '23505', detail: '(email)=(a@b.c)', table: 'customer' }))

    expect(AppError.isError(error)).toBe(true)
    expect((error as AppError).type).toBe(ErrorTypes.DUPLICATE_ERROR)
    expect((error as AppError).message).toContain('a@b.c')
  })

  it('maps a unique violation Drizzle wrapped in a DrizzleQueryError', () => {
    const error = thrownBy(dbErrorMapper, wrapped({ code: '23505', detail: '(email)=(a@b.c)', table: 'customer' }))

    expect(AppError.isError(error)).toBe(true)
    expect((error as AppError).type).toBe(ErrorTypes.DUPLICATE_ERROR)
    expect((error as AppError).message).toContain('a@b.c')
  })

  it('maps a wrapped foreign-key violation on insert to not_found', () => {
    const error = thrownBy(
      dbErrorMapper,
      wrapped({ code: '23503', detail: 'Key (cart_id)=(cart_x) is not present in table "cart".' }),
    )

    expect((error as AppError).type).toBe(ErrorTypes.NOT_FOUND)
  })

  it('maps a wrapped foreign-key violation on delete to not_allowed', () => {
    const error = thrownBy(
      dbErrorMapper,
      wrapped({ code: '23503', detail: 'Key (id)=(opt_1) is still referenced from table "product_product_option".' }),
    )

    expect((error as AppError).type).toBe(ErrorTypes.NOT_ALLOWED)
    expect((error as AppError).message).toContain('product_product_option')
  })

  it('maps a wrapped not-null violation to invalid_data', () => {
    const error = thrownBy(dbErrorMapper, wrapped({ code: '23502', column: 'email' }))

    expect((error as AppError).type).toBe(ErrorTypes.INVALID_DATA)
    expect((error as AppError).message).toContain('email')
  })

  it('rethrows a wrapper whose cause is not a Postgres error the mapper knows', () => {
    const wrapper = wrapped({ code: '08006' })

    expect(() => dbErrorMapper(wrapper)).toThrow(wrapper)
  })
})

describe('restoreErrorMapper', () => {
  it('reads a wrapped unique violation as a refilled slot', () => {
    const error = thrownBy(
      restoreErrorMapper,
      wrapped({ code: '23505', detail: '(slug)=(blue-tee)', table: 'product' }),
    )

    expect((error as AppError).type).toBe(ErrorTypes.DUPLICATE_ERROR)
    expect((error as AppError).message).toContain('Cannot restore')
    expect((error as AppError).message).toContain('blue-tee')
  })
})
