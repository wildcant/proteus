import { AppError, ErrorTypes } from './app-error.js'

interface PgError {
  code?: string
  detail?: string
  // biome-ignore lint/style/useNamingConvention: Postgres wire protocol field name
  constraint_name?: string
  column?: string
  // biome-ignore lint/style/useNamingConvention: Postgres wire protocol field name
  table_name?: string
}

function isPgError(err: unknown): err is PgError & Error {
  return err instanceof Error && 'code' in err
}

const getConstraintInfo = (err: PgError) => {
  const detail = err.detail
  if (!detail) {
    return null
  }

  const [keys, values] = detail.match(/\([^(]*\)/g) || []

  if (!keys || !values) {
    return null
  }

  return {
    table: err.table_name?.split('_').join(' ') ?? 'unknown',
    keys: keys
      .substring(1, keys.length - 1)
      .split(',')
      .map((k) => k.trim()),
    values: values
      .substring(1, values.length - 1)
      .split(',')
      .map((v) => v.trim()),
  }
}

/**
 * Names the table that blocked a delete, out of Postgres' detail line:
 *
 *     Key (id)=(opt_01H…) is still referenced from table "product_product_option".
 *
 * Null when the detail describes the other direction, or no detail came through at all.
 */
function blockingTable(err: PgError): string | null {
  return err.detail?.match(/is still referenced from table "([^"]+)"/)?.[1] ?? null
}

export function dbErrorMapper(err: unknown): never {
  if (AppError.isError(err)) {
    throw err
  }

  if (!isPgError(err)) {
    throw err
  }

  switch (err.code) {
    // unique_violation
    case '23505': {
      const info = getConstraintInfo(err)
      const message = info
        ? `${info.table}: ${info.keys.map((k, i) => `${k} "${info.values[i] ?? ''}"`).join(', ')} already exists`
        : 'Already exists'
      throw new AppError({
        type: ErrorTypes.DUPLICATE_ERROR,
        message,
      })
    }
    // not_null_violation
    case '23502': {
      const column = err.column || 'unknown'
      throw new AppError({
        type: ErrorTypes.INVALID_DATA,
        message: `Cannot be null: ${column}`,
      })
    }
    // foreign_key_violation. One code, two opposite meanings, told apart by the detail: an insert
    // names a parent that is not there, a delete leaves a child that still points at it. Reading
    // it as "the referenced row is missing" either way turned an in-use delete into a 404.
    case '23503': {
      const blocking = blockingTable(err)
      if (blocking) {
        throw new AppError({
          // The walker's restrict check raises this same shape, so a caller sees one contract
          // whether the refusal came from the database or from the application.
          type: ErrorTypes.NOT_ALLOWED,
          message: `Cannot delete: still referenced from table "${blocking}"`,
        })
      }
      throw new AppError({
        type: ErrorTypes.NOT_FOUND,
        message: 'Referenced entity does not exist',
      })
    }
    // undefined_column
    case '42703': {
      throw new AppError({
        type: ErrorTypes.INVALID_DATA,
        message: 'Invalid field referenced',
      })
    }
    default:
      throw err
  }
}

/**
 * The same failures, told from the point of view of a restore.
 *
 * Clearing `deleted_at` puts a row back into every partial unique index that excludes hidden
 * rows, so anything that took its slot while it was away surfaces as an ordinary unique
 * violation. Reported as one, "slug \"blue-tee\" already exists" reads like a bad create and
 * sends the reader looking for a duplicate request that never happened. The row being restored
 * is the one that is late, and the message has to say so.
 */
export function restoreErrorMapper(err: unknown): never {
  if (AppError.isError(err)) {
    throw err
  }

  if (isPgError(err) && err.code === '23505') {
    const info = getConstraintInfo(err)
    const slot = info ? `${info.keys.map((k, i) => `${k} "${info.values[i] ?? ''}"`).join(', ')}` : 'a unique value'
    throw new AppError({
      type: ErrorTypes.DUPLICATE_ERROR,
      message: `Cannot restore ${info?.table ?? 'the record'}: ${slot} was taken by another record while it was deleted`,
    })
  }

  return dbErrorMapper(err)
}
