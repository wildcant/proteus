/** The words of an option value, lower-cased and split at anything not a letter or a digit. */
function valueWords(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean),
  )
}

/**
 * The buckets a value belongs in: every one of `buckets` listing one of its words, in their order, so
 * "Black and White" is in Black and in White. Empty when none lists any.
 */
export function bucketsFor(value: string, buckets: Array<{ id: string; words: string[] }>): string[] {
  const words = valueWords(value)
  return buckets.filter((bucket) => bucket.words.some((word) => words.has(word))).map((bucket) => bucket.id)
}
