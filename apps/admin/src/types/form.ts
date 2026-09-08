export type SubmitFormParams<T = undefined> = {
  onSuccess?: T extends undefined ? () => void : (params: T) => void
  onError?: (error: string) => void
  onSettled?: () => void
}

/**
 * The message off a rejected mutation.
 *
 * The fetcher only ever throws an `Error`, so the fallback is unreachable — it exists because
 * `strict` types a catch binding as `unknown`. The merchant-facing message is the toast the
 * mutation hook raises; this is what the caller gets for deciding whether to stay open.
 */
export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong')
